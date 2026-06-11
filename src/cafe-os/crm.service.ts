import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import { UpdateCustomerDto } from './dto/cafe-os.dto';

const CUSTOMER_USER_SELECT = {
  select: {
    id: true,
    username: true,
    name: true,
    avatarUrl: true,
    dateOfBirth: true,
  },
};

export type TimelineEntry = {
  type: 'checkin' | 'scan' | 'review' | 'rsvp' | 'loyalty';
  at: Date;
  label: string;
  meta?: Record<string, unknown>;
};

@Injectable()
export class CrmService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /** Upsert a customer record when a user visits (check-in). */
  async recordVisit(cafeId: string, userId: string) {
    return this.prisma.cafeCustomer.upsert({
      where: { cafeId_userId: { cafeId, userId } },
      create: { cafeId, userId, visitCount: 1 },
      update: { visitCount: { increment: 1 }, lastVisitAt: new Date() },
    });
  }

  /** Upsert a customer record when an authenticated user scans a QR menu. */
  async recordScan(cafeId: string, userId: string) {
    return this.prisma.cafeCustomer.upsert({
      where: { cafeId_userId: { cafeId, userId } },
      create: { cafeId, userId, scanCount: 1 },
      update: { scanCount: { increment: 1 }, lastVisitAt: new Date() },
    });
  }

  async listCustomers(
    cafeId: string,
    params: { q?: string; sort?: 'recent' | 'visits'; cursor?: string; limit?: number },
  ) {
    const { q, sort = 'recent', cursor, limit = 30 } = params;
    const where: Prisma.CafeCustomerWhereInput = {
      cafeId,
      ...(q
        ? {
            user: {
              OR: [
                { username: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    const items = await this.prisma.cafeCustomer.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy:
        sort === 'visits' ? { visitCount: 'desc' } : { lastVisitAt: 'desc' },
      include: { user: CUSTOMER_USER_SELECT },
    });
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;

    const [total, vips] = await Promise.all([
      this.prisma.cafeCustomer.count({ where: { cafeId } }),
      this.prisma.cafeCustomer.count({ where: { cafeId, isVip: true } }),
    ]);

    return {
      data,
      nextCursor: hasMore ? data[data.length - 1]?.id : null,
      totals: { customers: total, vips },
    };
  }

  async customerDetail(cafeId: string, customerId: string) {
    const customer = await this.prisma.cafeCustomer.findUnique({
      where: { id: customerId },
      include: { user: CUSTOMER_USER_SELECT },
    });
    if (!customer || customer.cafeId !== cafeId) {
      throw new NotFoundException('Customer not found');
    }
    const userId = customer.userId;

    const [checkins, scans, reviews, rsvps, loyalty] = await Promise.all([
      this.prisma.checkin.findMany({
        where: { cafeId, userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { createdAt: true, source: true, mood: true },
      }),
      this.prisma.qrScan.findMany({
        where: { cafeId, userId },
        orderBy: { scannedAt: 'desc' },
        take: 30,
        include: { qrCode: { select: { kind: true, label: true } } },
      }),
      this.prisma.review.findMany({
        where: { cafeId, authorId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { createdAt: true, rating: true, body: true },
      }),
      this.prisma.eventRsvp.findMany({
        where: { userId, event: { cafeId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { event: { select: { title: true, startsAt: true } } },
      }),
      this.prisma.loyaltyCardProgress.findMany({
        where: { userId, program: { cafeId } },
        include: {
          program: {
            select: { id: true, title: true, kind: true, goal: true, rewardLabel: true },
          },
        },
      }),
    ]);

    const timeline: TimelineEntry[] = [
      ...checkins.map((c) => ({
        type: 'checkin' as const,
        at: c.createdAt,
        label: c.source === 'QR' ? 'QR check-in' : 'Check-in',
        meta: { mood: c.mood },
      })),
      ...scans.map((s) => ({
        type: 'scan' as const,
        at: s.scannedAt,
        label: s.qrCode?.label
          ? `Scanned menu (${s.qrCode.label})`
          : 'Scanned menu',
        meta: { kind: s.qrCode?.kind ?? null },
      })),
      ...reviews.map((r) => ({
        type: 'review' as const,
        at: r.createdAt,
        label: `Left a ${r.rating}-star review`,
        meta: { body: r.body },
      })),
      ...rsvps.map((r) => ({
        type: 'rsvp' as const,
        at: r.createdAt,
        label: `RSVP'd to ${r.event.title}`,
        meta: { startsAt: r.event.startsAt },
      })),
      ...loyalty
        .filter((l) => l.completedAt)
        .map((l) => ({
          type: 'loyalty' as const,
          at: l.completedAt as Date,
          label: `Completed "${l.program.title}"`,
          meta: { reward: l.program.rewardLabel },
        })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime());

    return { customer, loyalty, timeline: timeline.slice(0, 60) };
  }

  async updateCustomer(
    actorId: string,
    cafeId: string,
    customerId: string,
    dto: UpdateCustomerDto,
  ) {
    const customer = await this.prisma.cafeCustomer.findUnique({
      where: { id: customerId },
    });
    if (!customer || customer.cafeId !== cafeId) {
      throw new NotFoundException('Customer not found');
    }
    const updated = await this.prisma.cafeCustomer.update({
      where: { id: customerId },
      data: dto,
      include: { user: CUSTOMER_USER_SELECT },
    });
    await this.audit.log({
      cafeId,
      actorId,
      action: 'customer.updated',
      entity: 'customer',
      entityId: customerId,
      meta: { fields: Object.keys(dto) },
    });
    return updated;
  }
}
