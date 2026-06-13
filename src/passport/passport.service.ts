import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  ActivityType,
  BadgeCode,
  BeanScoreAction,
  CheckinSource,
  NotificationType,
  PostType,
  StreakType,
} from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { BeanScoreService } from '../beanscore/beanscore.service';
import { CafeOsHooksService } from '../cafe-os/cafe-os-hooks.service';
import { ChallengesService } from '../challenges/challenges.service';
import { CollectiblesService } from '../collectibles/collectibles.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PromotionsService } from '../promotions/promotions.service';
import { PrismaService } from '../prisma/prisma.service';
import { StreakService } from '../streaks/streaks.service';
import { PassportCheckinDto } from './dto/passport-checkin.dto';

const DAILY_CHECKIN_LIMIT = 10;
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_CHECKIN_DISTANCE_METERS = 250;

@Injectable()
export class PassportService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private beanScore: BeanScoreService,
    private challenges: ChallengesService,
    private streaks: StreakService,
    private collectibles: CollectiblesService,
    private activity: ActivityService,
    private notifications: NotificationsService,
    private promotions: PromotionsService,
    private cafeOsHooks: CafeOsHooksService,
  ) {}

  async onModuleInit() {
    await this.ensureCatalog();
  }

  private async ensureCatalog() {
    const badgeCount = await this.prisma.badgeDefinition.count();
    if (badgeCount > 0) return;

    await this.prisma.badgeDefinition.createMany({
      data: [
        {
          code: BadgeCode.FIRST_CHECKIN,
          name: 'First Sip',
          description: 'Completed your first cafe check-in',
          iconKey: 'coffee',
          threshold: 1,
          thresholdType: 'checkins',
        },
        {
          code: BadgeCode.FIVE_CAFES,
          name: 'Explorer',
          description: 'Visited 5 different cafes',
          iconKey: 'compass',
          threshold: 5,
          thresholdType: 'stamps',
        },
        {
          code: BadgeCode.TEN_CAFES,
          name: 'Regular',
          description: 'Collected 10 cafe stamps',
          iconKey: 'star',
          threshold: 10,
          thresholdType: 'stamps',
        },
        {
          code: BadgeCode.TWENTY_CAFES,
          name: 'City Roamer',
          description: 'Collected 20 cafe stamps',
          iconKey: 'map',
          threshold: 20,
          thresholdType: 'stamps',
        },
        {
          code: BadgeCode.WEEKLY_EXPLORER,
          name: 'Weekly Explorer',
          description: '3 check-ins in 7 days',
          iconKey: 'calendar',
          threshold: 3,
          thresholdType: 'weekly_checkins',
        },
      ],
      skipDuplicates: true,
    });

    await this.prisma.rewardDefinition.createMany({
      data: [
        {
          id: 'reward-3-stamps',
          slug: 'warm-up',
          title: 'Warm-up perk',
          description: '10% off your next visit at partner cafes',
          requiredStamps: 3,
          rewardType: 'DISCOUNT_10',
        },
        {
          id: 'reward-5-stamps',
          slug: 'regular',
          title: 'Regular reward',
          description: 'Free drink upgrade at partner cafes',
          requiredStamps: 5,
          rewardType: 'FREE_DRINK',
        },
        {
          id: 'reward-10-stamps',
          slug: 'insider',
          title: 'Insider reward',
          description: '20% off at partner cafes',
          requiredStamps: 10,
          rewardType: 'DISCOUNT_20',
        },
        {
          id: 'reward-20-stamps',
          slug: 'legend',
          title: 'Legend status',
          description: 'Exclusive partner perk',
          requiredStamps: 20,
          rewardType: 'PARTNER_PERK',
        },
      ],
      skipDuplicates: true,
    });
  }

  private haversineMeters(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ) {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  private startOfUtcDay() {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private async getOrCreatePassport(userId: string) {
    return this.prisma.passport.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async getMyPassport(userId: string) {
    const passport = await this.getOrCreatePassport(userId);
    const [stamps, badges, rewards, rewardCatalog] = await Promise.all([
      this.prisma.stamp.findMany({
        where: { passportId: passport.id },
        include: {
          cafe: { include: { photos: { take: 1, orderBy: { order: 'asc' } } } },
        },
        orderBy: { earnedAt: 'desc' },
        take: 100,
      }),
      this.prisma.userBadge.findMany({
        where: { userId },
        include: { badge: true },
        orderBy: { earnedAt: 'desc' },
      }),
      this.prisma.userReward.findMany({
        where: { userId },
        include: { reward: true },
        orderBy: { unlockedAt: 'desc' },
      }),
      this.prisma.rewardDefinition.findMany({
        where: { active: true },
        orderBy: { requiredStamps: 'asc' },
      }),
    ]);

    const unlockedIds = new Set(rewards.map((r) => r.rewardId));
    const catalog = rewardCatalog.map((r) => ({
      ...r,
      unlocked: unlockedIds.has(r.id),
      redeemed: rewards.find((ur) => ur.rewardId === r.id)?.redeemedAt != null,
    }));

    const nextReward = catalog.find((r) => !r.unlocked) ?? null;

    return {
      passport,
      stamps,
      badges,
      rewards,
      rewardCatalog: catalog,
      nextReward,
      progress: {
        stamps: passport.totalStamps,
        checkins: passport.totalCheckins,
        nextRewardAt: nextReward?.requiredStamps ?? null,
      },
    };
  }

  async checkin(userId: string, dto: PassportCheckinDto) {
    if (!dto.cafeId && !dto.checkinCode) {
      throw new BadRequestException('Provide cafeId or checkinCode');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.cityId) {
      throw new BadRequestException('Complete profile with city first');
    }

    const cafe = dto.checkinCode
      ? await this.prisma.cafe.findUnique({
          where: { checkinCode: dto.checkinCode },
        })
      : await this.prisma.cafe.findUnique({ where: { id: dto.cafeId } });

    if (!cafe) {
      throw new NotFoundException('Cafe not found');
    }

    if (dto.lat != null && dto.lng != null) {
      const distance = this.haversineMeters(
        dto.lat,
        dto.lng,
        cafe.lat,
        cafe.lng,
      );
      if (distance > MAX_CHECKIN_DISTANCE_METERS) {
        throw new BadRequestException('You must be near the cafe to check in');
      }
    }

    const dayStart = this.startOfUtcDay();
    const dailyCount = await this.prisma.checkin.count({
      where: { userId, createdAt: { gte: dayStart } },
    });
    if (dailyCount >= DAILY_CHECKIN_LIMIT) {
      throw new BadRequestException('Daily check-in limit reached');
    }

    const recentSameCafe = await this.prisma.checkin.findFirst({
      where: {
        userId,
        cafeId: cafe.id,
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
    });
    if (recentSameCafe) {
      throw new BadRequestException('Already checked in at this cafe today');
    }

    const source = dto.checkinCode ? CheckinSource.QR : CheckinSource.APP;
    const passport = await this.getOrCreatePassport(userId);

    const result = await this.prisma.$transaction(async (tx) => {
      const checkin = await tx.checkin.create({
        data: {
          userId,
          cafeId: cafe.id,
          cityId: cafe.cityId,
          countryId: cafe.countryId,
          source,
          mood: dto.mood ?? null,
          status: dto.status ?? null,
          withUserIds: dto.withUserIds ?? [],
        },
        include: {
          cafe: { include: { photos: { take: 1 } } },
        },
      });

      await tx.post.create({
        data: {
          authorId: userId,
          cafeId: cafe.id,
          checkinId: checkin.id,
          type: PostType.CHECKIN,
          caption: `${user.name ?? user.username ?? 'Someone'} checked in at ${cafe.name}`,
          cityId: cafe.cityId,
          countryId: cafe.countryId,
        },
      });

      let newStamp = false;
      const existingStamp = await tx.stamp.findUnique({
        where: {
          passportId_cafeId: { passportId: passport.id, cafeId: cafe.id },
        },
      });

      let stamp = existingStamp;
      if (!existingStamp) {
        stamp = await tx.stamp.create({
          data: {
            passportId: passport.id,
            cafeId: cafe.id,
            checkinId: checkin.id,
          },
          include: { cafe: { include: { photos: { take: 1 } } } },
        });
        newStamp = true;
      }

      await tx.passport.update({
        where: { id: passport.id },
        data: {
          totalCheckins: { increment: 1 },
          ...(newStamp ? { totalStamps: { increment: 1 } } : {}),
        },
      });

      return { checkin, stamp, newStamp };
    });

    const updatedPassport = await this.prisma.passport.findUniqueOrThrow({
      where: { id: passport.id },
    });

    const earnedBadges = await this.evaluateBadges(userId, updatedPassport);
    const unlockedRewards = await this.evaluateRewards(
      userId,
      updatedPassport.totalStamps,
    );

    await this.beanScore.award(
      userId,
      BeanScoreAction.CHECKIN,
      result.checkin.id,
    );
    if (result.newStamp && result.stamp) {
      await this.beanScore.award(
        userId,
        BeanScoreAction.NEW_STAMP,
        result.stamp.id,
      );
    }

    await this.challenges.recordCheckin(userId, result.newStamp, cafe.id);

    // Streak engine: extend consecutive + weekly streaks.
    const [consecutive, weekly] = await Promise.all([
      this.streaks.touch(userId, StreakType.CONSECUTIVE_CHECKIN),
      this.streaks.touch(userId, StreakType.WEEKLY_CAFE),
    ]);
    const streakMilestone = consecutive.milestone ?? weekly.milestone ?? null;

    // Collectible card for this cafe.
    const collectible = await this.collectibles.grantForCafe(
      userId,
      cafe.id,
      result.checkin.id,
    );

    // Activity feed records (friends + collectibles + badges + streaks).
    await this.activity.record({
      actorId: userId,
      type: ActivityType.FRIEND_CHECKIN,
      cafeId: cafe.id,
      checkinId: result.checkin.id,
      cityId: cafe.cityId,
      payload: {
        mood: dto.mood ?? null,
        status: dto.status ?? null,
        withCount: dto.withUserIds?.length ?? 0,
      },
    });
    if (collectible.isNew) {
      await this.activity.record({
        actorId: userId,
        type: ActivityType.FRIEND_COLLECTED_CARD,
        cafeId: cafe.id,
        cityId: cafe.cityId,
        payload: {
          rarity: collectible.card.rarity,
          cardName: collectible.card.name,
        },
      });
    }
    for (const b of earnedBadges) {
      await this.activity.record({
        actorId: userId,
        type: ActivityType.FRIEND_EARNED_BADGE,
        badgeCode: b.badgeCode,
        cityId: cafe.cityId,
      });
    }
    if (streakMilestone) {
      await this.activity.record({
        actorId: userId,
        type: ActivityType.FRIEND_STREAK_MILESTONE,
        cityId: cafe.cityId,
        payload: { milestone: streakMilestone },
      });
    }

    // Notify followers that a friend just checked in (capped fan-out).
    await this.notifyFollowersOfCheckin(userId, cafe.id, cafe.name);

    const dailyWin = await this.promotions.tryWinOnCheckin(
      userId,
      cafe.id,
      result.checkin.id,
      cafe.isPartner,
    );
    // Cafe OS: CRM record, loyalty progress, live dashboard tick.
    const cafeOs = await this.cafeOsHooks.onCheckin(cafe.id, userId);

    return {
      checkin: result.checkin,
      loyalty: cafeOs?.completedPrograms ?? [],
      stamp: result.stamp,
      newStamp: result.newStamp,
      passport: updatedPassport,
      earnedBadges,
      unlockedRewards,
      collectible: collectible.isNew ? collectible.card : null,
      streaks: { consecutive, weekly, milestone: streakMilestone },
      dailyWin,
    };
  }

  private async notifyFollowersOfCheckin(
    actorId: string,
    cafeId: string,
    cafeName: string,
  ) {
    const followers = await this.prisma.userFollow.findMany({
      where: { followingId: actorId },
      select: { followerId: true },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
    await Promise.all(
      followers.map((f) =>
        this.notifications.create({
          userId: f.followerId,
          type: NotificationType.FRIEND_CHECKIN,
          actorId,
          entityType: 'cafe',
          entityId: cafeId,
          payload: { cafeName },
        }),
      ),
    );
  }

  private async evaluateBadges(
    userId: string,
    passport: { totalStamps: number; totalCheckins: number },
  ) {
    const definitions = await this.prisma.badgeDefinition.findMany();
    const existing = await this.prisma.userBadge.findMany({
      where: { userId },
      select: { badgeCode: true },
    });
    const have = new Set(existing.map((b) => b.badgeCode));
    const earned: BadgeCode[] = [];

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyCheckins = await this.prisma.checkin.count({
      where: { userId, createdAt: { gte: weekAgo } },
    });

    for (const def of definitions) {
      if (have.has(def.code)) continue;
      let met = false;
      if (def.thresholdType === 'stamps') {
        met = passport.totalStamps >= def.threshold;
      } else if (def.thresholdType === 'checkins') {
        met = passport.totalCheckins >= def.threshold;
      } else if (def.thresholdType === 'weekly_checkins') {
        met = weeklyCheckins >= def.threshold;
      }
      if (met) {
        await this.prisma.userBadge.create({
          data: { userId, badgeCode: def.code },
        });
        earned.push(def.code);
      }
    }

    if (!earned.length) return [];
    return this.prisma.userBadge.findMany({
      where: { userId, badgeCode: { in: earned } },
      include: { badge: true },
    });
  }

  private async evaluateRewards(userId: string, totalStamps: number) {
    const eligible = await this.prisma.rewardDefinition.findMany({
      where: { active: true, requiredStamps: { lte: totalStamps } },
    });
    const existing = await this.prisma.userReward.findMany({
      where: { userId },
      select: { rewardId: true },
    });
    const have = new Set(existing.map((r) => r.rewardId));
    const toUnlock = eligible.filter((r) => !have.has(r.id));
    if (!toUnlock.length) return [];

    await this.prisma.userReward.createMany({
      data: toUnlock.map((r) => ({ userId, rewardId: r.id })),
      skipDuplicates: true,
    });

    return this.prisma.userReward.findMany({
      where: { userId, rewardId: { in: toUnlock.map((r) => r.id) } },
      include: { reward: true },
    });
  }

  async redeemReward(userId: string, rewardId: string) {
    const userReward = await this.prisma.userReward.findUnique({
      where: { userId_rewardId: { userId, rewardId } },
      include: { reward: true },
    });
    if (!userReward) {
      throw new BadRequestException('Reward not unlocked yet');
    }
    if (userReward.redeemedAt) {
      throw new BadRequestException('Reward already redeemed');
    }
    return this.prisma.userReward.update({
      where: { id: userReward.id },
      data: { redeemedAt: new Date() },
      include: { reward: true },
    });
  }

  async resolveCafeByCode(code: string) {
    const cafe = await this.prisma.cafe.findUnique({
      where: { checkinCode: code },
      include: { photos: { take: 1, orderBy: { order: 'asc' } } },
    });
    if (!cafe) throw new NotFoundException('Invalid check-in code');
    return cafe;
  }
}
