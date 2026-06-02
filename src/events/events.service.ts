import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { EventRsvpStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

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
          title: 'Saturday cupping',
          description: 'Taste three single-origin pours with the community.',
          cafeId: cafe?.id,
          cityId: cafe?.cityId,
          locationLabel: cafe?.name ?? 'Partner cafe',
          startsAt: in3days,
          endsAt: new Date(in3days.getTime() + 2 * 60 * 60 * 1000),
        },
        {
          title: 'Remote work meetup',
          description: 'Bring your laptop — compare WiFi scores and swap cafe tips.',
          cityId: cafe?.cityId,
          locationLabel: 'City center',
          startsAt: in7days,
          endsAt: new Date(in7days.getTime() + 3 * 60 * 60 * 1000),
        },
      ],
    });
  }

  listUpcoming(cityId?: string, limit = 20) {
    const now = new Date();
    return this.prisma.communityEvent.findMany({
      where: {
        endsAt: { gte: now },
        OR: [{ cityId: null }, ...(cityId ? [{ cityId }] : [])],
      },
      orderBy: { startsAt: 'asc' },
      take: limit,
      include: {
        cafe: { select: { id: true, name: true, address: true } },
        city: { select: { id: true, name: true } },
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
        _count: { select: { rsvps: true } },
        rsvps: userId
          ? { where: { userId }, take: 1 }
          : false,
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    const myRsvp = userId && Array.isArray(event.rsvps) ? event.rsvps[0] : null;
    const { rsvps, ...rest } = event;
    return { ...rest, myRsvp: myRsvp?.status ?? null };
  }

  async rsvp(userId: string, eventId: string, status: EventRsvpStatus) {
    await this.get(eventId);
    return this.prisma.eventRsvp.upsert({
      where: { userId_eventId: { userId, eventId } },
      create: { userId, eventId, status },
      update: { status },
    });
  }
}
