import { Injectable } from '@nestjs/common';
import { ActivityType, BadgeCode, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ACTOR_SELECT = {
  select: { id: true, username: true, name: true, avatarUrl: true },
};
const CAFE_SELECT = {
  select: {
    id: true,
    name: true,
    address: true,
    photos: { take: 1, orderBy: { order: 'asc' as const } },
  },
};
const EVENT_SELECT = {
  select: { id: true, title: true, type: true, startsAt: true, coverUrl: true },
};
const SQUAD_SELECT = {
  select: { id: true, name: true, slug: true, emoji: true, category: true },
};

const FEED_WINDOW_DAYS = 14;

export interface RecordActivityInput {
  actorId: string;
  type: ActivityType;
  cafeId?: string | null;
  eventId?: string | null;
  squadId?: string | null;
  badgeCode?: BadgeCode | null;
  checkinId?: string | null;
  cityId?: string | null;
  payload?: Prisma.InputJsonValue;
}

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  /** Append an item to the activity ledger. Fire-and-forget friendly. */
  async record(input: RecordActivityInput) {
    return this.prisma.friendActivity.create({
      data: {
        actorId: input.actorId,
        type: input.type,
        cafeId: input.cafeId ?? null,
        eventId: input.eventId ?? null,
        squadId: input.squadId ?? null,
        badgeCode: input.badgeCode ?? null,
        checkinId: input.checkinId ?? null,
        cityId: input.cityId ?? null,
        payload: input.payload,
      },
    });
  }

  /**
   * Ranked activity feed. Combines activity from followed users with
   * city-relevant broadcast activity (trending cafes, new events, squads),
   * then ranks by friend-relevance + freshness + engagement + locality.
   */
  async feed(userId: string, limit = 20, offset = 0) {
    const [following, me] = await Promise.all([
      this.prisma.userFollow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { cityId: true },
      }),
    ]);

    const followingIds = following.map((f) => f.followingId);
    const since = new Date(Date.now() - FEED_WINDOW_DAYS * 86400000);

    const broadcastTypes: ActivityType[] = [
      ActivityType.CAFE_TRENDING,
      ActivityType.EVENT_ANNOUNCED,
      ActivityType.SQUAD_ACTIVITY,
    ];

    const where: Prisma.FriendActivityWhereInput = {
      createdAt: { gte: since },
      actorId: { not: userId },
      OR: [
        ...(followingIds.length ? [{ actorId: { in: followingIds } }] : []),
        {
          type: { in: broadcastTypes },
          ...(me?.cityId ? { cityId: me.cityId } : {}),
        },
      ],
    };

    // Over-fetch a ranking window, then score + paginate in memory.
    const candidates = await this.prisma.friendActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, (offset + limit) * 4 + limit),
      include: {
        actor: ACTOR_SELECT,
        cafe: CAFE_SELECT,
        event: EVENT_SELECT,
        squad: SQUAD_SELECT,
      },
    });

    const followSet = new Set(followingIds);
    const now = Date.now();
    const ranked = candidates
      .map((a) => {
        const hoursAgo = (now - a.createdAt.getTime()) / 3600000;
        const friendRelevance = followSet.has(a.actorId) ? 60 : 0;
        const freshness = Math.max(0, 50 - hoursAgo * 1.5);
        const engagement = a.cheerCount * 4;
        const locality = me?.cityId && a.cityId === me.cityId ? 15 : 0;
        return { activity: a, score: friendRelevance + freshness + engagement + locality };
      })
      .sort((x, y) => y.score - x.score);

    const page = ranked.slice(offset, offset + limit).map((r) => r.activity);
    return {
      data: page,
      nextOffset: offset + limit < ranked.length ? offset + limit : null,
    };
  }

  async cheer(userId: string, activityId: string) {
    return this.prisma.friendActivity.update({
      where: { id: activityId },
      data: { cheerCount: { increment: 1 } },
      select: { id: true, cheerCount: true },
    });
  }
}
