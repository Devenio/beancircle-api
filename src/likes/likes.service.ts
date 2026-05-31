import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class LikesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async togglePost(userId: string, postId: string) {
    const existing = await this.prisma.like.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    if (existing) {
      await this.prisma.like.delete({ where: { id: existing.id } });
      return { liked: false };
    }
    const post = await this.prisma.post.findUniqueOrThrow({
      where: { id: postId },
    });
    await this.prisma.like.create({ data: { userId, postId } });
    if (post.authorId !== userId) {
      await this.notifications.create({
        userId: post.authorId,
        type: NotificationType.NEW_LIKE,
        actorId: userId,
        entityType: 'post',
        entityId: postId,
      });
    }
    return { liked: true };
  }

  async toggleReview(userId: string, reviewId: string) {
    const existing = await this.prisma.like.findUnique({
      where: { userId_reviewId: { userId, reviewId } },
    });
    if (existing) {
      await this.prisma.like.delete({ where: { id: existing.id } });
      return { liked: false };
    }
    const review = await this.prisma.review.findUniqueOrThrow({
      where: { id: reviewId },
    });
    await this.prisma.like.create({ data: { userId, reviewId } });
    if (review.authorId !== userId) {
      await this.notifications.create({
        userId: review.authorId,
        type: NotificationType.NEW_LIKE,
        actorId: userId,
        entityType: 'review',
        entityId: reviewId,
      });
    }
    return { liked: true };
  }
}
