import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, PostType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async create(
    authorId: string,
    data: {
      type: PostType;
      caption?: string;
      cafeId?: string;
      photoUrls?: string[];
    },
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: authorId },
    });
    if (!user.cityId || !user.countryId) {
      throw new NotFoundException('Set city on profile first');
    }
    const post = await this.prisma.$transaction(async (tx) => {
      const p = await tx.post.create({
        data: {
          authorId,
          type: data.type,
          caption: data.caption,
          cafeId: data.cafeId,
          cityId: user.cityId!,
          countryId: user.countryId!,
          photos: data.photoUrls?.length
            ? {
                create: data.photoUrls.map((url, order) => ({ url, order })),
              }
            : undefined,
        },
        include: {
          author: {
            select: { id: true, username: true, name: true, avatarUrl: true },
          },
          photos: true,
          cafe: true,
          _count: { select: { likes: true, comments: true } },
        },
      });
      await tx.user.update({
        where: { id: authorId },
        data: { postsCount: { increment: 1 } },
      });
      return p;
    });
    return post;
  }

  async getFeed(userId: string, cursor?: string, limit = 20) {
    const following = await this.prisma.userFollow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const cafeFollows = await this.prisma.cafeFollow.findMany({
      where: { userId },
      select: { cafeId: true },
    });
    const authorIds = [...following.map((f) => f.followingId), userId];
    const cafeIds = cafeFollows.map((f) => f.cafeId);

    const items = await this.prisma.post.findMany({
      where: {
        OR: [
          { authorId: { in: authorIds } },
          ...(cafeIds.length ? [{ cafeId: { in: cafeIds } }] : []),
        ],
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: this.postInclude(userId),
    });
    return this.paginate(items, limit);
  }

  async getById(id: string, userId?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: this.postInclude(userId),
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async getByUsername(username: string, cursor?: string, limit = 20) {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });
    if (!user) throw new NotFoundException('User not found');
    const items = await this.prisma.post.findMany({
      where: { authorId: user.id },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: this.postInclude(),
    });
    return this.paginate(items, limit);
  }

  async save(userId: string, postId: string) {
    await this.prisma.savedPost.upsert({
      where: { userId_postId: { userId, postId } },
      create: { userId, postId },
      update: {},
    });
    return { saved: true };
  }

  async unsave(userId: string, postId: string) {
    await this.prisma.savedPost.deleteMany({ where: { userId, postId } });
    return { saved: false };
  }

  private postInclude(userId?: string) {
    return {
      author: {
        select: { id: true, username: true, name: true, avatarUrl: true },
      },
      photos: { orderBy: { order: 'asc' as const } },
      cafe: true,
      checkin: { include: { cafe: true } },
      _count: { select: { likes: true, comments: true } },
      ...(userId
        ? {
            likes: { where: { userId }, take: 1 },
            savedBy: { where: { userId }, take: 1 },
          }
        : {}),
    };
  }

  private paginate<T extends { id: string }>(items: T[], limit: number) {
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    return {
      data: data.map((p) => ({
        ...p,
        liked: 'likes' in p && Array.isArray(p.likes) && p.likes.length > 0,
        saved:
          'savedBy' in p && Array.isArray(p.savedBy) && p.savedBy.length > 0,
      })),
      nextCursor: hasMore ? data[data.length - 1]?.id : null,
    };
  }
}
