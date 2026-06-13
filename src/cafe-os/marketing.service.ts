import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Announcement, NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuditService } from './audit.service';
import { UpsertAnnouncementDto } from './dto/cafe-os.dto';

const FANOUT_CAP = 500;

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private realtime: RealtimeGateway,
    private audit: AuditService,
  ) {}

  async list(cafeId: string) {
    const [items, reach] = await Promise.all([
      this.prisma.announcement.findMany({
        where: { cafeId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.cafeFollow.count({ where: { cafeId } }),
    ]);
    return {
      reach,
      data: items.map((a) => ({ ...a, status: this.status(a) })),
    };
  }

  private status(a: Announcement) {
    if (a.publishedAt) return 'published';
    if (a.scheduledAt) return 'scheduled';
    return 'draft';
  }

  async create(actorId: string, cafeId: string, dto: UpsertAnnouncementDto) {
    const { publishNow, scheduledAt, expiresAt, ...fields } = dto;
    const announcement = await this.prisma.announcement.create({
      data: {
        cafeId,
        createdById: actorId,
        ...fields,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
    await this.audit.log({
      cafeId,
      actorId,
      action: 'announcement.created',
      entity: 'announcement',
      entityId: announcement.id,
      meta: { title: dto.title, kind: dto.kind },
    });
    if (publishNow) {
      return this.publish(announcement.id);
    }
    return { ...announcement, status: this.status(announcement) };
  }

  async update(
    actorId: string,
    cafeId: string,
    id: string,
    dto: Partial<UpsertAnnouncementDto>,
  ) {
    const existing = await this.require(cafeId, id);
    if (existing.publishedAt && !dto.publishNow) {
      throw new BadRequestException('Published announcements cannot be edited');
    }
    const { publishNow, scheduledAt, expiresAt, ...fields } = dto;
    const updated = await this.prisma.announcement.update({
      where: { id },
      data: {
        ...fields,
        ...(scheduledAt !== undefined
          ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }
          : {}),
        ...(expiresAt !== undefined
          ? { expiresAt: expiresAt ? new Date(expiresAt) : null }
          : {}),
      },
    });
    await this.audit.log({
      cafeId,
      actorId,
      action: 'announcement.updated',
      entity: 'announcement',
      entityId: id,
    });
    if (publishNow && !updated.publishedAt) {
      return this.publish(id);
    }
    return { ...updated, status: this.status(updated) };
  }

  async remove(actorId: string, cafeId: string, id: string) {
    await this.require(cafeId, id);
    await this.prisma.announcement.delete({ where: { id } });
    await this.audit.log({
      cafeId,
      actorId,
      action: 'announcement.deleted',
      entity: 'announcement',
      entityId: id,
    });
    return { deleted: true };
  }

  /** Consumer feed of published, unexpired announcements for a cafe. */
  listPublished(cafeId: string, limit = 20) {
    return this.prisma.announcement.findMany({
      where: {
        cafeId,
        publishedAt: { not: null },
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
  }

  async publish(id: string) {
    const announcement = await this.prisma.announcement.update({
      where: { id },
      data: { publishedAt: new Date(), scheduledAt: null },
      include: { cafe: { select: { id: true, name: true, logoUrl: true } } },
    });

    // Fan out to followers (capped) without blocking the response.
    void this.fanout(announcement).catch((e: Error) =>
      this.logger.error(`Announcement fanout failed: ${e.message}`),
    );

    this.realtime.emitToCafe(announcement.cafeId, 'cafe:announcement', {
      id: announcement.id,
      title: announcement.title,
    });
    return { ...announcement, status: 'published' as const };
  }

  private async fanout(
    announcement: Announcement & { cafe: { name: string } },
  ) {
    const followers = await this.prisma.cafeFollow.findMany({
      where: { cafeId: announcement.cafeId },
      select: { userId: true },
      take: FANOUT_CAP,
      orderBy: { createdAt: 'desc' },
    });
    for (const f of followers) {
      await this.notifications.create({
        userId: f.userId,
        type: NotificationType.CAFE_ANNOUNCEMENT,
        entityType: 'announcement',
        entityId: announcement.id,
        payload: {
          cafeId: announcement.cafeId,
          cafeName: announcement.cafe.name,
          kind: announcement.kind,
          title: announcement.title,
        },
      });
    }
  }

  /** Publish scheduled announcements whose time has come. */
  @Cron('* * * * *')
  async publishScheduled() {
    const due = await this.prisma.announcement.findMany({
      where: { publishedAt: null, scheduledAt: { lte: new Date() } },
      select: { id: true },
      take: 20,
    });
    for (const a of due) {
      try {
        await this.publish(a.id);
      } catch (e) {
        this.logger.error(
          `Failed to publish scheduled announcement ${a.id}: ${(e as Error).message}`,
        );
      }
    }
  }

  private async require(cafeId: string, id: string) {
    const a = await this.prisma.announcement.findUnique({ where: { id } });
    if (!a || a.cafeId !== cafeId) {
      throw new NotFoundException('Announcement not found');
    }
    return a;
  }
}
