import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PostsService } from '../posts/posts.service';

@Injectable()
export class CommunityService {
  constructor(
    private prisma: PrismaService,
    private posts: PostsService,
  ) {}

  async activityFeed(userId: string, cursor?: string, limit = 20) {
    const feed = await this.posts.getFeed(userId, cursor, limit);
    const following = await this.prisma.userFollow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
      take: 50,
    });
    const followingIds = following.map((f) => f.followingId);

    const recentCheckins = await this.prisma.checkin.findMany({
      where: {
        userId: { in: [...followingIds, userId] },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
        cafe: { include: { photos: { take: 1 } } },
      },
    });

    return {
      posts: feed,
      recentCheckins,
    };
  }
}
