import { Injectable } from '@nestjs/common';
import { BadgeCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConnectionBadgesService {
  constructor(private prisma: PrismaService) {}

  private async ensureBadgeDefinitions() {
    const defs = [
      {
        code: BadgeCode.FIRST_FRIEND,
        name: 'First Friend',
        description: 'Made your first friend on BeanCircle',
        iconKey: 'users',
        threshold: 1,
        thresholdType: 'friends',
      },
      {
        code: BadgeCode.EXPLORER,
        name: 'Explorer',
        description: 'Discovered 10 people nearby',
        iconKey: 'compass',
        threshold: 10,
        thresholdType: 'discoveries',
      },
      {
        code: BadgeCode.SOCIAL_BUTTERFLY,
        name: 'Social Butterfly',
        description: 'Connected with 25 friends',
        iconKey: 'sparkles',
        threshold: 25,
        thresholdType: 'friends',
      },
      {
        code: BadgeCode.NETWORK_BUILDER,
        name: 'Network Builder',
        description: 'Connected with 50 friends',
        iconKey: 'network',
        threshold: 50,
        thresholdType: 'friends',
      },
    ];
    for (const d of defs) {
      await this.prisma.badgeDefinition.upsert({
        where: { code: d.code },
        create: d,
        update: { name: d.name, description: d.description },
      });
    }
  }

  async onFriendshipCreated(userId: string) {
    await this.ensureBadgeDefinitions();
    const count = await this.prisma.friendship.count({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
    });
    const codes: BadgeCode[] = [];
    if (count >= 1) codes.push(BadgeCode.FIRST_FRIEND);
    if (count >= 25) codes.push(BadgeCode.SOCIAL_BUTTERFLY);
    if (count >= 50) codes.push(BadgeCode.NETWORK_BUILDER);
    for (const code of codes) {
      await this.prisma.userBadge.upsert({
        where: { userId_badgeCode: { userId, badgeCode: code } },
        create: { userId, badgeCode: code },
        update: {},
      });
    }
  }

  async onDailyDiscovery(userId: string) {
    await this.ensureBadgeDefinitions();
    const count = await this.prisma.dailyDiscovery.groupBy({
      by: ['discoveredId'],
      where: { userId },
    });
    if (count.length >= 10) {
      await this.prisma.userBadge.upsert({
        where: { userId_badgeCode: { userId, badgeCode: BadgeCode.EXPLORER } },
        create: { userId, badgeCode: BadgeCode.EXPLORER },
        update: {},
      });
    }
  }

  async touchConnectionStreak(userId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const streak = await this.prisma.connectionStreak.upsert({
      where: { userId },
      create: { userId, currentDays: 1, longestDays: 1, lastActiveDate: today },
      update: {},
    });
    const last = streak.lastActiveDate;
    if (last && last.getTime() === today.getTime()) return streak;
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const continued = last && last.getTime() === yesterday.getTime();
    const currentDays = continued ? streak.currentDays + 1 : 1;
    const longestDays = Math.max(streak.longestDays, currentDays);
    return this.prisma.connectionStreak.update({
      where: { userId },
      data: { currentDays, longestDays, lastActiveDate: today },
    });
  }
}
