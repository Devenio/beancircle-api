import { Injectable } from '@nestjs/common';
import { BeanScoreAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const POINTS: Record<BeanScoreAction, number> = {
  CHECKIN: 25,
  NEW_STAMP: 15,
  POST: 10,
  POST_PHOTO: 15,
  REVIEW: 20,
  LIKE_RECEIVED: 5,
  DAILY_ACTIVE: 5,
  REFERRAL: 50,
  CHALLENGE_COMPLETE: 100,
  BEAN: 10,
  BEAN_MEDIA: 15,
  BEAN_REPLY: 4,
  BEAN_REACTION_RECEIVED: 2,
  BEAN_REBEAN_RECEIVED: 8,
  BEAN_POPULAR: 50,
};

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 2000];

@Injectable()
export class BeanScoreService {
  constructor(private prisma: PrismaService) {}

  private calcLevel(points: number) {
    let level = 1;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (points >= LEVEL_THRESHOLDS[i]) {
        level = i + 1;
        break;
      }
    }
    return level;
  }

  async award(
    userId: string,
    action: BeanScoreAction,
    referenceId?: string,
    pointsOverride?: number,
  ) {
    const points = pointsOverride ?? POINTS[action];
    try {
      await this.prisma.beanScoreEvent.create({
        data: { userId, action, points, referenceId: referenceId ?? null },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return null;
      }
      throw e;
    }

    const profile = await this.prisma.beanScoreProfile.upsert({
      where: { userId },
      create: { userId, totalPoints: points, level: this.calcLevel(points) },
      update: { totalPoints: { increment: points } },
    });

    const level = this.calcLevel(profile.totalPoints);
    if (level !== profile.level) {
      await this.prisma.beanScoreProfile.update({
        where: { userId },
        data: { level },
      });
    }
    return { points, totalPoints: profile.totalPoints, level };
  }

  async claimDailyBonus(userId: string) {
    const day = new Date().toISOString().slice(0, 10);
    const result = await this.award(userId, BeanScoreAction.DAILY_ACTIVE, day);
    if (!result) {
      // Already claimed today (idempotent) — report current standing, no award.
      const profile = await this.getProfile(userId);
      return {
        claimed: false,
        points: 0,
        totalPoints: profile.totalPoints,
        level: profile.level,
      };
    }
    return { claimed: true, ...result };
  }

  async getProfile(userId: string) {
    const profile = await this.prisma.beanScoreProfile.findUnique({
      where: { userId },
    });
    const totalPoints = profile?.totalPoints ?? 0;
    const level = profile?.level ?? 1;
    const nextThreshold =
      LEVEL_THRESHOLDS.find((t) => t > totalPoints) ??
      LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];

    // When (if ever) the daily bonus was claimed today — drives the home card.
    const today = new Date().toISOString().slice(0, 10);
    const todayClaim = await this.prisma.beanScoreEvent.findFirst({
      where: {
        userId,
        action: BeanScoreAction.DAILY_ACTIVE,
        referenceId: today,
      },
      select: { createdAt: true },
    });

    return {
      totalPoints,
      level,
      nextThreshold,
      pointsToNext: Math.max(0, nextThreshold - totalPoints),
      dailyClaimedAt: todayClaim?.createdAt ?? null,
    };
  }

  async leaderboard(cityId?: string, limit = 20) {
    return this.prisma.beanScoreProfile.findMany({
      where: cityId ? { user: { cityId } } : {},
      orderBy: { totalPoints: 'desc' },
      take: Math.min(limit, 50),
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async recentEvents(userId: string, limit = 20) {
    return this.prisma.beanScoreEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
