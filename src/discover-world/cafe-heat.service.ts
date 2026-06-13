import { Injectable } from '@nestjs/common';
import { ActivityType } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export type CafeHeat = 'TRENDING' | 'BUSY' | 'POPULAR' | 'NEW' | null;

export type CafePresence = {
  presentCount: number;
  friendsPresent: number;
};

const PRESENCE_WINDOW_MS = 2 * 60 * 60 * 1000;
const HEAT_CACHE_TTL_SECONDS = 300;
const NEW_CAFE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const TRENDING_ACTIVITY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
/** Assume ~12 active hours/day when deriving an hourly baseline from daily stats. */
const ACTIVE_HOURS_PER_DAY = 12;

@Injectable()
export class CafeHeatService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private activity: ActivityService,
  ) {}

  /**
   * Distinct users checked into each cafe within the presence window,
   * plus how many of them are the viewer's friends.
   */
  async getPresence(
    cafeIds: string[],
    friendIds: Set<string>,
  ): Promise<Map<string, CafePresence>> {
    const result = new Map<string, CafePresence>();
    if (cafeIds.length === 0) return result;

    const rows = await this.prisma.checkin.findMany({
      where: {
        cafeId: { in: cafeIds },
        createdAt: { gte: new Date(Date.now() - PRESENCE_WINDOW_MS) },
      },
      select: { cafeId: true, userId: true },
    });

    const byCafe = new Map<string, Set<string>>();
    for (const row of rows) {
      let set = byCafe.get(row.cafeId);
      if (!set) {
        set = new Set();
        byCafe.set(row.cafeId, set);
      }
      set.add(row.userId);
    }

    for (const id of cafeIds) {
      const users = byCafe.get(id);
      if (!users) {
        result.set(id, { presentCount: 0, friendsPresent: 0 });
        continue;
      }
      let friendsPresent = 0;
      for (const uid of users) if (friendIds.has(uid)) friendsPresent++;
      result.set(id, { presentCount: users.size, friendsPresent });
    }
    return result;
  }

  /**
   * Heat label per cafe, derived from live presence vs the 7-day
   * CafeDailyStat baseline. Labels are cached in Redis for 5 minutes.
   */
  async getHeat(
    cafes: { id: string; createdAt: Date }[],
    presence: Map<string, CafePresence>,
  ): Promise<Map<string, CafeHeat>> {
    const result = new Map<string, CafeHeat>();
    if (cafes.length === 0) return result;

    const cacheKeys = cafes.map((c) => `world:heat:${c.id}`);
    const cached = await this.redis.client.mget(...cacheKeys);
    const misses: { id: string; createdAt: Date }[] = [];
    cafes.forEach((cafe, i) => {
      const raw = cached[i];
      if (raw != null) {
        result.set(cafe.id, raw === 'NONE' ? null : (raw as CafeHeat));
      } else {
        misses.push(cafe);
      }
    });
    if (misses.length === 0) return result;

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const stats = await this.prisma.cafeDailyStat.groupBy({
      by: ['cafeId'],
      where: {
        cafeId: { in: misses.map((c) => c.id) },
        date: { gte: weekAgo },
      },
      _sum: { visitors: true, newFollowers: true },
    });
    const statByCafe = new Map(
      stats.map((s) => [
        s.cafeId,
        {
          weeklyVisitors: s._sum.visitors ?? 0,
          weeklyNewFollowers: s._sum.newFollowers ?? 0,
        },
      ]),
    );

    const pipeline = this.redis.client.pipeline();
    const trendingIds: string[] = [];
    for (const cafe of misses) {
      const presentCount = presence.get(cafe.id)?.presentCount ?? 0;
      const stat = statByCafe.get(cafe.id) ?? {
        weeklyVisitors: 0,
        weeklyNewFollowers: 0,
      };
      const twoHourBaseline =
        (stat.weeklyVisitors / (7 * ACTIVE_HOURS_PER_DAY)) * 2;

      let heat: CafeHeat = null;
      if (presentCount >= Math.max(3, Math.ceil(twoHourBaseline * 2))) {
        heat = 'TRENDING';
      } else if (presentCount >= 5) {
        heat = 'BUSY';
      } else if (stat.weeklyVisitors >= 25 || stat.weeklyNewFollowers >= 10) {
        heat = 'POPULAR';
      } else if (Date.now() - cafe.createdAt.getTime() < NEW_CAFE_WINDOW_MS) {
        heat = 'NEW';
      }

      result.set(cafe.id, heat);
      pipeline.setex(
        `world:heat:${cafe.id}`,
        HEAT_CACHE_TTL_SECONDS,
        heat ?? 'NONE',
      );
      if (heat === 'TRENDING') trendingIds.push(cafe.id);
    }
    await pipeline.exec();

    for (const cafeId of trendingIds) {
      void this.recordTrendingActivity(cafeId).catch(() => undefined);
    }
    return result;
  }

  /** Writes a CAFE_TRENDING broadcast activity at most once per cooldown window. */
  private async recordTrendingActivity(cafeId: string) {
    const since = new Date(Date.now() - TRENDING_ACTIVITY_COOLDOWN_MS);
    const existing = await this.prisma.friendActivity.findFirst({
      where: {
        type: ActivityType.CAFE_TRENDING,
        cafeId,
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    if (existing) return null;

    // Use the most recent visitor as the actor: trending requires recent check-ins.
    const lastCheckin = await this.prisma.checkin.findFirst({
      where: { cafeId },
      orderBy: { createdAt: 'desc' },
      select: { userId: true, cityId: true },
    });
    if (!lastCheckin) return null;

    return this.activity.record({
      actorId: lastCheckin.userId,
      type: ActivityType.CAFE_TRENDING,
      cafeId,
      cityId: lastCheckin.cityId,
    });
  }
}
