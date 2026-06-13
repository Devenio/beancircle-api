import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  BeanScoreAction,
  ChallengeType,
  NotificationType,
} from '@prisma/client';
import { BeanScoreService } from '../beanscore/beanscore.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChallengesService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private beanScore: BeanScoreService,
    private notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    const count = await this.prisma.communityChallenge.count();
    if (count > 0) return;

    const now = new Date();
    const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.communityChallenge.createMany({
      data: [
        {
          title: 'Weekly Sipper',
          description: 'Check in at cafes 3 times this week',
          type: ChallengeType.CHECKIN_COUNT,
          goal: 3,
          rewardPoints: 75,
          startsAt: now,
          endsAt: week,
        },
        {
          title: 'Stamp Collector',
          description: 'Earn 2 new cafe stamps this week',
          type: ChallengeType.NEW_STAMPS,
          goal: 2,
          rewardPoints: 100,
          startsAt: now,
          endsAt: week,
        },
        {
          title: 'Cafe Explorer',
          description: 'Visit 4 different cafes this week',
          type: ChallengeType.VISIT_UNIQUE_CAFES,
          goal: 4,
          rewardPoints: 120,
          startsAt: now,
          endsAt: week,
        },
      ],
    });
  }

  listActive(cityId?: string, userId?: string) {
    const now = new Date();
    return this.prisma.communityChallenge.findMany({
      where: {
        active: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
        OR: [{ cityId: null }, ...(cityId ? [{ cityId }] : [])],
      },
      orderBy: { endsAt: 'asc' },
      include: {
        _count: { select: { participants: true } },
        ...(userId
          ? {
              participants: {
                where: { userId },
                take: 1,
              },
            }
          : {}),
      },
    });
  }

  async myProgress(userId: string) {
    return this.prisma.challengeParticipation.findMany({
      where: { userId },
      include: { challenge: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async recordCheckin(userId: string, _newStamp: boolean, _cafeId: string) {
    const now = new Date();
    const challenges = await this.prisma.communityChallenge.findMany({
      where: {
        active: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    });

    const passport = await this.prisma.passport.findUnique({
      where: { userId },
    });

    for (const challenge of challenges) {
      let progress = 0;
      if (challenge.type === ChallengeType.CHECKIN_COUNT) {
        progress = await this.prisma.checkin.count({
          where: {
            userId,
            createdAt: { gte: challenge.startsAt, lte: now },
          },
        });
      } else if (challenge.type === ChallengeType.NEW_STAMPS && passport) {
        progress = await this.prisma.stamp.count({
          where: {
            passportId: passport.id,
            earnedAt: { gte: challenge.startsAt, lte: now },
          },
        });
      } else if (challenge.type === ChallengeType.VISIT_UNIQUE_CAFES) {
        const visits = await this.prisma.checkin.findMany({
          where: {
            userId,
            createdAt: { gte: challenge.startsAt, lte: now },
          },
          distinct: ['cafeId'],
          select: { cafeId: true },
        });
        progress = visits.length;
      } else {
        continue;
      }

      const existing = await this.prisma.challengeParticipation.findUnique({
        where: {
          userId_challengeId: { userId, challengeId: challenge.id },
        },
      });

      const participation = await this.prisma.challengeParticipation.upsert({
        where: {
          userId_challengeId: { userId, challengeId: challenge.id },
        },
        create: {
          userId,
          challengeId: challenge.id,
          progress,
        },
        update: { progress },
      });

      if (
        !participation.completedAt &&
        !existing?.completedAt &&
        progress >= challenge.goal
      ) {
        await this.prisma.challengeParticipation.update({
          where: { id: participation.id },
          data: { completedAt: new Date(), progress: challenge.goal },
        });
        await this.beanScore.award(
          userId,
          BeanScoreAction.CHALLENGE_COMPLETE,
          challenge.id,
          challenge.rewardPoints,
        );
        await this.notifications.create({
          userId,
          type: NotificationType.CHALLENGE_COMPLETE,
          entityType: 'challenge',
          entityId: challenge.id,
          payload: {
            challengeTitle: challenge.title,
            points: challenge.rewardPoints,
          },
        });
      }
    }
  }
}
