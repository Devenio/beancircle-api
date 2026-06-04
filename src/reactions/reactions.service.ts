import { Injectable } from '@nestjs/common';
import { ReactionEmoji } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReactionsService {
  constructor(private prisma: PrismaService) {}

  async setPostReaction(userId: string, postId: string, emoji: ReactionEmoji) {
    await this.prisma.postReaction.upsert({
      where: { userId_postId: { userId, postId } },
      create: { userId, postId, emoji },
      update: { emoji },
    });
    return this.getPostReactions(postId, userId);
  }

  async removePostReaction(userId: string, postId: string) {
    await this.prisma.postReaction.deleteMany({ where: { userId, postId } });
    return this.getPostReactions(postId, userId);
  }

  async getPostReactions(postId: string, viewerId?: string) {
    const reactions = await this.prisma.postReaction.findMany({
      where: { postId },
    });
    const counts: Record<string, number> = {};
    for (const r of reactions) {
      counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
    }
    const mine = viewerId
      ? reactions.find((r) => r.userId === viewerId)?.emoji ?? null
      : null;
    return { counts, mine, total: reactions.length };
  }
}
