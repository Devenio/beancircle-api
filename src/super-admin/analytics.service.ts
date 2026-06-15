import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Maps a timeseries metric to its table + timestamp column. Whitelisted to
// keep the raw query injection-safe.
const METRIC_TABLES: Record<string, { table: string; column: string }> = {
  users: { table: '"User"', column: '"createdAt"' },
  cafes: { table: '"Cafe"', column: '"createdAt"' },
  posts: { table: '"Post"', column: '"createdAt"' },
  reviews: { table: '"Review"', column: '"createdAt"' },
  checkins: { table: '"Checkin"', column: '"createdAt"' },
  gifts: { table: '"GiftCoffee"', column: '"createdAt"' },
};

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async overview(days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const dauSince = new Date(Date.now() - 86_400_000);

    const [
      users,
      cafes,
      posts,
      reviews,
      checkins,
      gifts,
      newUsers,
      newCafes,
      newCheckins,
      dau,
      suspended,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.cafe.count(),
      this.prisma.post.count(),
      this.prisma.review.count(),
      this.prisma.checkin.count(),
      this.prisma.giftCoffee.count(),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.cafe.count({ where: { createdAt: { gte: since } } }),
      this.prisma.checkin.count({ where: { createdAt: { gte: since } } }),
      this.prisma.user.count({ where: { lastSeenAt: { gte: dauSince } } }),
      this.prisma.user.count({ where: { status: { not: 'ACTIVE' } } }),
    ]);

    return {
      totals: { users, cafes, posts, reviews, checkins, gifts },
      period: { days, newUsers, newCafes, newCheckins },
      activity: { dau, moderatedUsers: suspended },
    };
  }

  async timeseries(metric: string, days = 30) {
    const meta = METRIC_TABLES[metric];
    if (!meta) {
      throw new BadRequestException(
        `Unknown metric. Use one of: ${Object.keys(METRIC_TABLES).join(', ')}`,
      );
    }
    const since = new Date(Date.now() - days * 86_400_000);
    // table/column come from a whitelist above, value is parameterised.
    const rows = await this.prisma.$queryRawUnsafe<
      { day: Date; count: bigint }[]
    >(
      `SELECT date_trunc('day', ${meta.column}) AS day, count(*)::bigint AS count
       FROM ${meta.table}
       WHERE ${meta.column} >= $1
       GROUP BY day
       ORDER BY day ASC`,
      since,
    );
    return rows.map((r) => ({
      date: r.day.toISOString().slice(0, 10),
      count: Number(r.count),
    }));
  }

  async topCafes(limit = 10) {
    return this.prisma.cafe.findMany({
      select: {
        id: true,
        name: true,
        avgRating: true,
        followerCount: true,
        reviewCount: true,
        city: { select: { name: true } },
      },
      orderBy: [{ followerCount: 'desc' }, { avgRating: 'desc' }],
      take: Math.min(limit, 50),
    });
  }

  async usersByRole() {
    const grouped = await this.prisma.user.groupBy({
      by: ['role'],
      _count: { _all: true },
    });
    return grouped.map((g) => ({
      role: g.role,
      count: g._count._all,
    }));
  }
}
