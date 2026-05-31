import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async createOnPost(
    authorId: string,
    postId: string,
    body: string,
  ) {
    const post = await this.prisma.post.findUniqueOrThrow({
      where: { id: postId },
    });
    const comment = await this.prisma.comment.create({
      data: { authorId, postId, body },
      include: {
        author: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
    });
    if (post.authorId !== authorId) {
      await this.notifications.create({
        userId: post.authorId,
        type: NotificationType.NEW_COMMENT,
        actorId: authorId,
        entityType: 'post',
        entityId: postId,
      });
    }
    return comment;
  }

  async createOnReview(
    authorId: string,
    reviewId: string,
    body: string,
  ) {
    const review = await this.prisma.review.findUniqueOrThrow({
      where: { id: reviewId },
    });
    const comment = await this.prisma.comment.create({
      data: { authorId, reviewId, body },
      include: {
        author: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
    });
    if (review.authorId !== authorId) {
      await this.notifications.create({
        userId: review.authorId,
        type: NotificationType.NEW_COMMENT,
        actorId: authorId,
        entityType: 'review',
        entityId: reviewId,
      });
    }
    return comment;
  }

  listForPost(postId: string) {
    return this.prisma.comment.findMany({
      where: { postId },
      include: {
        author: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  listForReview(reviewId: string) {
    return this.prisma.comment.findMany({
      where: { reviewId },
      include: {
        author: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
