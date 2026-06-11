import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class CafeAnalyticsService {
  private readonly logger = new Logger(CafeAnalyticsService.name);

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
  ) {}

  /** Push a live stats tick into the cafe's dashboard room. */
  emitStats(cafeId: string, payload: Record<string, unknown>) {
    this.realtime.emitToCafe(cafeId, 'cafe:stats', { cafeId, ...payload });
  }

  async dashboard(cafeId: string) {
    const today = startOfDay(new Date());
    const now = new Date();

    const [
      cafe,
      visitorsToday,
      scansToday,
      newCustomersToday,
      returningToday,
      followersTotal,
      activePromotions,
      popularItems,
      upcomingEvents,
    ] = await Promise.all([
      this.prisma.cafe.findUniqueOrThrow({
        where: { id: cafeId },
        select: {
          id: true,
          name: true,
          followerCount: true,
          avgRating: true,
          reviewCount: true,
        },
      }),
      this.prisma.checkin.count({
        where: { cafeId, createdAt: { gte: today } },
      }),
      this.prisma.qrScan.count({
        where: { cafeId, scannedAt: { gte: today } },
      }),
      this.prisma.cafeCustomer.count({
        where: { cafeId, firstVisitAt: { gte: today } },
      }),
      this.prisma.cafeCustomer.count({
        where: { cafeId, lastVisitAt: { gte: today }, visitCount: { gt: 1 } },
      }),
      this.prisma.cafeFollow.count({ where: { cafeId } }),
      this.prisma.announcement.findMany({
        where: {
          cafeId,
          publishedAt: { not: null },
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
        orderBy: { publishedAt: 'desc' },
        take: 5,
      }),
      this.prisma.menuItem.findMany({
        where: { category: { menu: { cafeId } } },
        orderBy: { viewCount: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          price: true,
          imageUrl: true,
          viewCount: true,
          category: { select: { name: true } },
        },
      }),
      this.prisma.communityEvent.findMany({
        where: { cafeId, endsAt: { gte: now } },
        orderBy: { startsAt: 'asc' },
        take: 3,
        include: { _count: { select: { rsvps: true } } },
      }),
    ]);

    return {
      cafe,
      today: {
        visitors: visitorsToday,
        qrScans: scansToday,
        newCustomers: newCustomersToday,
        returningCustomers: returningToday,
      },
      followers: followersTotal,
      activePromotions,
      popularItems,
      upcomingEvents,
      // Future-ready placeholder so the dashboard can render a revenue widget.
      revenue: null,
    };
  }

  async analytics(cafeId: string, range: '7d' | '30d' | '90d' = '30d') {
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const since = startOfDay(
      new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000),
    );

    const [checkins, scans, follows, customers, topItems, events] =
      await Promise.all([
        this.prisma.checkin.findMany({
          where: { cafeId, createdAt: { gte: since } },
          select: { createdAt: true, userId: true },
        }),
        this.prisma.qrScan.findMany({
          where: { cafeId, scannedAt: { gte: since } },
          select: { scannedAt: true },
        }),
        this.prisma.cafeFollow.findMany({
          where: { cafeId, createdAt: { gte: since } },
          select: { createdAt: true },
        }),
        this.prisma.cafeCustomer.findMany({
          where: { cafeId },
          select: { visitCount: true, firstVisitAt: true, lastVisitAt: true },
        }),
        this.prisma.menuItem.findMany({
          where: { category: { menu: { cafeId } } },
          orderBy: { viewCount: 'desc' },
          take: 8,
          select: { id: true, name: true, viewCount: true },
        }),
        this.prisma.communityEvent.findMany({
          where: { cafeId, startsAt: { gte: since } },
          include: { _count: { select: { rsvps: true } } },
          orderBy: { startsAt: 'asc' },
          take: 20,
        }),
      ]);

    // Build a contiguous day-by-day series.
    const series: Record<
      string,
      { date: string; visitors: number; qrScans: number; followers: number }
    > = {};
    for (let i = 0; i < days; i += 1) {
      const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
      const key = dayKey(d);
      series[key] = { date: key, visitors: 0, qrScans: 0, followers: 0 };
    }
    for (const c of checkins) {
      const key = dayKey(c.createdAt);
      if (series[key]) series[key].visitors += 1;
    }
    for (const s of scans) {
      const key = dayKey(s.scannedAt);
      if (series[key]) series[key].qrScans += 1;
    }
    for (const f of follows) {
      const key = dayKey(f.createdAt);
      if (series[key]) series[key].followers += 1;
    }

    const returning = customers.filter((c) => c.visitCount > 1).length;
    const activeInRange = customers.filter(
      (c) => c.lastVisitAt >= since,
    ).length;

    return {
      range,
      series: Object.values(series),
      totals: {
        visitors: checkins.length,
        uniqueVisitors: new Set(checkins.map((c) => c.userId)).size,
        qrScans: scans.length,
        newFollowers: follows.length,
        customers: customers.length,
        returningCustomers: returning,
        returningRate:
          customers.length > 0
            ? Math.round((returning / customers.length) * 100)
            : 0,
        activeCustomers: activeInRange,
      },
      topItems,
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        startsAt: e.startsAt,
        attendance: e._count.rsvps,
      })),
    };
  }

  /** Nightly rollup of yesterday's activity into CafeDailyStat. */
  @Cron('10 0 * * *')
  async rollupDailyStats() {
    const dayEnd = startOfDay(new Date());
    const dayStart = new Date(dayEnd.getTime() - 24 * 60 * 60 * 1000);
    const window = { gte: dayStart, lt: dayEnd };

    const [checkins, scans, newCustomers, follows] = await Promise.all([
      this.prisma.checkin.groupBy({
        by: ['cafeId'],
        where: { createdAt: window },
        _count: { _all: true },
      }),
      this.prisma.qrScan.groupBy({
        by: ['cafeId'],
        where: { scannedAt: window },
        _count: { _all: true },
      }),
      this.prisma.cafeCustomer.groupBy({
        by: ['cafeId'],
        where: { firstVisitAt: window },
        _count: { _all: true },
      }),
      this.prisma.cafeFollow.groupBy({
        by: ['cafeId'],
        where: { createdAt: window },
        _count: { _all: true },
      }),
    ]);
    const returning = await this.prisma.cafeCustomer.groupBy({
      by: ['cafeId'],
      where: { lastVisitAt: window, visitCount: { gt: 1 } },
      _count: { _all: true },
    });

    const stats = new Map<
      string,
      {
        visitors: number;
        qrScans: number;
        newCustomers: number;
        returningCustomers: number;
        newFollowers: number;
      }
    >();
    const ensure = (cafeId: string) => {
      if (!stats.has(cafeId)) {
        stats.set(cafeId, {
          visitors: 0,
          qrScans: 0,
          newCustomers: 0,
          returningCustomers: 0,
          newFollowers: 0,
        });
      }
      return stats.get(cafeId)!;
    };
    for (const r of checkins) ensure(r.cafeId).visitors = r._count._all;
    for (const r of scans) ensure(r.cafeId).qrScans = r._count._all;
    for (const r of newCustomers) ensure(r.cafeId).newCustomers = r._count._all;
    for (const r of returning)
      ensure(r.cafeId).returningCustomers = r._count._all;
    for (const r of follows) ensure(r.cafeId).newFollowers = r._count._all;

    for (const [cafeId, s] of stats) {
      await this.prisma.cafeDailyStat.upsert({
        where: { cafeId_date: { cafeId, date: dayStart } },
        create: { cafeId, date: dayStart, ...s },
        update: s,
      });
    }
    this.logger.log(`Rolled up daily stats for ${stats.size} cafes`);
  }
}
