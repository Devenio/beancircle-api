import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const CAFE_INCLUDE = {
  photos: { take: 1, orderBy: { order: 'asc' as const } },
  city: true,
};

export type DiscoverFilterKey =
  | 'bestCoffee'
  | 'bestWorkspace'
  | 'quiet'
  | 'studyFriendly'
  | 'fastWifi'
  | 'outdoorSeating'
  | 'dateFriendly'
  | 'petFriendly';

@Injectable()
export class DiscoverService {
  constructor(private prisma: PrismaService) {}

  private buildWhere(
    cityId?: string,
    filters: DiscoverFilterKey[] = [],
    q?: string,
  ): Prisma.CafeWhereInput {
    const where: Prisma.CafeWhereInput = {};
    if (cityId) where.cityId = cityId;
    if (q?.trim()) {
      where.name = { contains: q.trim(), mode: 'insensitive' };
    }
    for (const f of filters) {
      where[f] = true;
    }
    return where;
  }

  async query(
    cityId?: string,
    filters: DiscoverFilterKey[] = [],
    q?: string,
    sort: 'trending' | 'rating' | 'new' = 'trending',
    limit = 30,
  ) {
    const where = this.buildWhere(cityId, filters, q);
    const orderBy: Prisma.CafeOrderByWithRelationInput[] =
      sort === 'new'
        ? [{ createdAt: 'desc' }]
        : sort === 'rating'
          ? [{ avgRating: 'desc' }, { reviewCount: 'desc' }]
          : [{ followerCount: 'desc' }, { reviewCount: 'desc' }];

    return this.prisma.cafe.findMany({
      where,
      include: CAFE_INCLUDE,
      orderBy,
      take: Math.min(limit, 50),
    });
  }

  async sections(cityId?: string, userId?: string) {
    if (!cityId && userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { cityId: true },
      });
      cityId = user?.cityId ?? undefined;
    }

    const baseWhere: Prisma.CafeWhereInput = cityId ? { cityId } : {};

    const [trending, newest, hiddenGems, recommended] = await Promise.all([
      this.prisma.cafe.findMany({
        where: baseWhere,
        include: CAFE_INCLUDE,
        orderBy: [{ followerCount: 'desc' }, { avgRating: 'desc' }],
        take: 10,
      }),
      this.prisma.cafe.findMany({
        where: baseWhere,
        include: CAFE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.cafe.findMany({
        where: {
          ...baseWhere,
          avgRating: { gte: 4 },
          followerCount: { lte: 50 },
        },
        include: CAFE_INCLUDE,
        orderBy: [{ avgRating: 'desc' }, { reviewCount: 'desc' }],
        take: 10,
      }),
      this.getRecommended(baseWhere, userId),
    ]);

    return { trending, new: newest, hiddenGems, recommended };
  }

  private async getRecommended(
    baseWhere: Prisma.CafeWhereInput,
    userId?: string,
  ) {
    if (!userId) {
      return this.prisma.cafe.findMany({
        where: { ...baseWhere, isPartner: true },
        include: CAFE_INCLUDE,
        orderBy: { avgRating: 'desc' },
        take: 10,
      });
    }

    const stamped = await this.prisma.stamp.findMany({
      where: { passport: { userId } },
      select: { cafeId: true },
    });
    const stampedIds = stamped.map((s) => s.cafeId);

    return this.prisma.cafe.findMany({
      where: {
        ...baseWhere,
        id: stampedIds.length ? { notIn: stampedIds } : undefined,
        OR: [{ bestCoffee: true }, { bestWorkspace: true }, { isPartner: true }],
      },
      include: CAFE_INCLUDE,
      orderBy: [{ workspaceScore: 'desc' }, { avgRating: 'desc' }],
      take: 10,
    });
  }
}
