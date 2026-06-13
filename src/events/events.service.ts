import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import {
  ActivityType,
  EventRsvpStatus,
  EventType,
  NotificationType,
  Prisma,
  StreakType,
} from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StreakService } from '../streaks/streaks.service';
import { CreateEventDto } from './dto/event.dto';

const HOST_SELECT = {
  select: { id: true, username: true, name: true, avatarUrl: true },
};

@Injectable()
export class EventsService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    private notifications: NotificationsService,
    private streaks: StreakService,
  ) {}

  async onModuleInit() {
    const count = await this.prisma.communityEvent.count();
    if (count > 0) return;

    const now = new Date();
    const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const cafe = await this.prisma.cafe.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    await this.prisma.communityEvent.createMany({
      data: [
        {
          title: 'Open Mic Night',
          description: 'Share a song, a poem, or a story. All welcome.',
          type: EventType.OPEN_MIC,
          cafeId: cafe?.id,
          cityId: cafe?.cityId,
          locationLabel: cafe?.name ?? 'Partner cafe',
          startsAt: in3days,
          endsAt: new Date(in3days.getTime() + 2 * 60 * 60 * 1000),
        },
        {
          title: 'Board Game Night',
          description: 'Catan, Codenames, Uno — bring your A-game.',
          type: EventType.GAME_NIGHT,
          cityId: cafe?.cityId,
          locationLabel: 'City center',
          startsAt: in7days,
          endsAt: new Date(in7days.getTime() + 3 * 60 * 60 * 1000),
        },
      ],
    });
  }

  listUpcoming(
    params: {
      cityId?: string;
      type?: EventType;
      cafeId?: string;
      limit?: number;
    } = {},
  ) {
    const { cityId, type, cafeId, limit = 30 } = params;
    const now = new Date();
    const where: Prisma.CommunityEventWhereInput = {
      endsAt: { gte: now },
      ...(type ? { type } : {}),
      ...(cafeId
        ? { cafeId }
        : cityId
          ? { OR: [{ cityId: null }, { cityId }] }
          : {}),
    };
    return this.prisma.communityEvent.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      take: Math.min(limit, 50),
      include: {
        cafe: { select: { id: true, name: true, address: true } },
        city: { select: { id: true, name: true } },
        host: HOST_SELECT,
        _count: { select: { rsvps: true } },
      },
    });
  }

  async get(id: string, userId?: string) {
    const event = await this.prisma.communityEvent.findUnique({
      where: { id },
      include: {
        cafe: true,
        city: true,
        host: HOST_SELECT,
        _count: { select: { rsvps: true } },
        rsvps: userId ? { where: { userId }, take: 1 } : false,
        reminders: userId ? { where: { userId }, take: 1 } : false,
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    const myRsvp = userId && Array.isArray(event.rsvps) ? event.rsvps[0] : null;
    const myReminder =
      userId && Array.isArray(event.reminders) ? event.reminders[0] : null;
    const { rsvps, reminders, ...rest } = event;
    return {
      ...rest,
      myRsvp: myRsvp?.status ?? null,
      myReminder: myReminder?.remindAt ?? null,
    };
  }

  /** All events of a cafe (upcoming first, then recent past) for Cafe OS. */
  listForCafe(cafeId: string) {
    return this.prisma.communityEvent.findMany({
      where: { cafeId },
      orderBy: { startsAt: 'desc' },
      take: 50,
      include: {
        host: HOST_SELECT,
        _count: { select: { rsvps: true } },
      },
    });
  }

  participants(eventId: string) {
    return this.prisma.eventRsvp.findMany({
      where: { eventId },
      orderBy: { createdAt: 'asc' },
      include: { user: HOST_SELECT },
    });
  }

  async create(userId: string, dto: CreateEventDto) {
    let cityId = dto.cityId ?? null;
    if (dto.cafeId) {
      const cafe = await this.prisma.cafe.findUnique({
        where: { id: dto.cafeId },
        select: { cityId: true },
      });
      if (!cafe) throw new NotFoundException('Cafe not found');
      cityId = cityId ?? cafe.cityId;
    }
    if (!cityId) {
      const u = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { cityId: true },
      });
      cityId = u?.cityId ?? null;
    }

    const event = await this.prisma.communityEvent.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        cafeId: dto.cafeId,
        cityId,
        hostId: userId,
        capacity: dto.capacity,
        locationLabel: dto.locationLabel,
        coverUrl: dto.coverUrl,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
      },
    });

    await this.activity.record({
      actorId: userId,
      type: ActivityType.EVENT_ANNOUNCED,
      eventId: event.id,
      cafeId: dto.cafeId ?? null,
      cityId,
    });

    return event;
  }

  async rsvp(userId: string, eventId: string, status: EventRsvpStatus) {
    const event = await this.prisma.communityEvent.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, hostId: true, cityId: true, startsAt: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    const existing = await this.prisma.eventRsvp.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });
    const rsvp = await this.prisma.eventRsvp.upsert({
      where: { userId_eventId: { userId, eventId } },
      create: { userId, eventId, status },
      update: { status },
    });

    if (status === EventRsvpStatus.GOING && existing?.status !== EventRsvpStatus.GOING) {
      await this.streaks.touch(userId, StreakType.EVENT_PARTICIPATION);
      await this.activity.record({
        actorId: userId,
        type: ActivityType.FRIEND_JOINED_EVENT,
        eventId,
        cityId: event.cityId,
      });
      // Default reminder one hour before the event.
      const remindAt = new Date(event.startsAt.getTime() - 60 * 60 * 1000);
      if (remindAt.getTime() > Date.now()) {
        await this.prisma.eventReminder.upsert({
          where: { userId_eventId: { userId, eventId } },
          create: { userId, eventId, remindAt },
          update: { remindAt, sentAt: null },
        });
      }
      if (event.hostId && event.hostId !== userId) {
        await this.notifications.create({
          userId: event.hostId,
          type: NotificationType.FRIEND_JOINED_EVENT,
          actorId: userId,
          entityType: 'event',
          entityId: eventId,
          payload: { title: event.title },
        });
      }
    }

    return rsvp;
  }

  async setReminder(userId: string, eventId: string, remindAt?: string) {
    const event = await this.prisma.communityEvent.findUnique({
      where: { id: eventId },
      select: { startsAt: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    const when = remindAt
      ? new Date(remindAt)
      : new Date(event.startsAt.getTime() - 60 * 60 * 1000);
    return this.prisma.eventReminder.upsert({
      where: { userId_eventId: { userId, eventId } },
      create: { userId, eventId, remindAt: when },
      update: { remindAt: when, sentAt: null },
    });
  }

  async clearReminder(userId: string, eventId: string) {
    await this.prisma.eventReminder.deleteMany({ where: { userId, eventId } });
    return { ok: true };
  }
}
