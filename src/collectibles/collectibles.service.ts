import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { CardRarity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CollectiblesService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.backfillCards();
  }

  /** Every cafe maps to exactly one collectible card. */
  private async backfillCards() {
    const cafesWithout = await this.prisma.cafe.findMany({
      where: { collectibleCard: null },
      select: { id: true, name: true },
      take: 1000,
    });
    if (!cafesWithout.length) return;
    await this.prisma.collectibleCard.createMany({
      data: cafesWithout.map((c) => ({
        cafeId: c.id,
        name: c.name,
        rarity: this.rarityForCafe(c.id),
      })),
      skipDuplicates: true,
    });
  }

  /** Deterministic rarity so a cafe always yields the same card. */
  private rarityForCafe(cafeId: string): CardRarity {
    let hash = 0;
    for (let i = 0; i < cafeId.length; i++) {
      hash = (hash * 31 + cafeId.charCodeAt(i)) % 100;
    }
    if (hash < 60) return CardRarity.COMMON;
    if (hash < 85) return CardRarity.UNCOMMON;
    if (hash < 95) return CardRarity.RARE;
    if (hash < 99) return CardRarity.EPIC;
    return CardRarity.LEGENDARY;
  }

  private async ensureCard(cafeId: string) {
    const existing = await this.prisma.collectibleCard.findUnique({
      where: { cafeId },
    });
    if (existing) return existing;
    const cafe = await this.prisma.cafe.findUnique({
      where: { id: cafeId },
      select: { name: true },
    });
    if (!cafe) throw new NotFoundException('Cafe not found');
    return this.prisma.collectibleCard.create({
      data: { cafeId, name: cafe.name, rarity: this.rarityForCafe(cafeId) },
    });
  }

  /** Grant the card for a cafe to a user (idempotent). */
  async grantForCafe(userId: string, cafeId: string, checkinId?: string) {
    const card = await this.ensureCard(cafeId);
    const existing = await this.prisma.userCollectible.findUnique({
      where: { userId_cardId: { userId, cardId: card.id } },
    });
    if (existing) return { card, isNew: false };
    await this.prisma.userCollectible.create({
      data: { userId, cardId: card.id, checkinId: checkinId ?? null },
    });
    return { card, isNew: true };
  }

  async getMine(userId: string) {
    const [total, owned, recent, rarityGroups] = await Promise.all([
      this.prisma.collectibleCard.count(),
      this.prisma.userCollectible.count({ where: { userId } }),
      this.prisma.userCollectible.findMany({
        where: { userId },
        orderBy: { collectedAt: 'desc' },
        take: 60,
        include: {
          card: {
            include: {
              cafe: {
                select: {
                  id: true,
                  name: true,
                  photos: { take: 1, orderBy: { order: 'asc' } },
                },
              },
            },
          },
        },
      }),
      this.prisma.userCollectible.findMany({
        where: { userId },
        select: { card: { select: { rarity: true } } },
      }),
    ]);

    const byRarity: Record<string, number> = {};
    for (const r of Object.values(CardRarity)) byRarity[r] = 0;
    for (const g of rarityGroups) byRarity[g.card.rarity] += 1;

    return {
      progress: {
        owned,
        total,
        percent: total ? Math.round((owned / total) * 100) : 0,
      },
      byRarity,
      recent,
    };
  }

  /** Public collection summary for another user's profile. */
  async summaryFor(userId: string) {
    const [total, owned] = await Promise.all([
      this.prisma.collectibleCard.count(),
      this.prisma.userCollectible.count({ where: { userId } }),
    ]);
    return { owned, total, percent: total ? Math.round((owned / total) * 100) : 0 };
  }
}
