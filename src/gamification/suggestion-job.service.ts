import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryVisibility, InterestSlug } from '@prisma/client';
import { friendshipPair } from '../common/geo/geo.util';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuggestionJobService implements OnModuleInit {
  private readonly logger = new Logger(SuggestionJobService.name);
  private interval: NodeJS.Timeout | null = null;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    this.interval = setInterval(() => {
      void this.refreshAllSuggestions().catch((e) =>
        this.logger.error('Suggestion refresh failed', e),
      );
    }, 7 * 24 * 60 * 60 * 1000);
  }

  async refreshAllSuggestions() {
    const users = await this.prisma.user.findMany({
      where: {
        settings: { discoveryVisibility: { not: DiscoveryVisibility.HIDDEN } },
      },
      select: { id: true, cityId: true },
      take: 500,
    });
    for (const u of users) {
      await this.refreshForUser(u.id);
    }
  }

  async refreshForUser(userId: string) {
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        interests: true,
        friendshipsAsA: true,
        friendshipsAsB: true,
        settings: true,
      },
    });
    if (!me || me.settings?.discoveryVisibility === DiscoveryVisibility.HIDDEN) return;

    const friendIds = new Set([
      ...me.friendshipsAsA.map((f) => f.userBId),
      ...me.friendshipsAsB.map((f) => f.userAId),
    ]);
    const myInterests = new Set(me.interests.map((i) => i.interest));

    const candidates = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        cityId: me.cityId ?? undefined,
        settings: { discoveryVisibility: { not: DiscoveryVisibility.HIDDEN } },
      },
      include: { interests: true, friendshipsAsA: true, friendshipsAsB: true },
      take: 100,
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    for (const c of candidates) {
      if (friendIds.has(c.id)) continue;
      const cFriends = new Set([
        ...c.friendshipsAsA.map((f) => f.userBId),
        ...c.friendshipsAsB.map((f) => f.userAId),
      ]);
      let mutual = 0;
      for (const fid of friendIds) if (cFriends.has(fid)) mutual++;
      const shared = c.interests.filter((i) => myInterests.has(i.interest)).length;
      if (mutual === 0 && shared === 0) continue;
      const score = mutual * 0.6 + shared * 0.4;
      const reason = mutual > 0 ? 'mutual_friends' : 'shared_interests';
      await this.prisma.suggestedConnection.upsert({
        where: { userId_suggestedId: { userId, suggestedId: c.id } },
        create: { userId, suggestedId: c.id, score, reason, expiresAt },
        update: { score, reason, expiresAt, dismissedAt: null },
      });
    }
  }
}
