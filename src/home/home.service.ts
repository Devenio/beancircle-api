import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PostsService } from '../posts/posts.service';
import { CafesService } from '../cafes/cafes.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HomeService {
  constructor(
    private posts: PostsService,
    private cafes: CafesService,
    private notifications: NotificationsService,
    private prisma: PrismaService,
  ) {}

  async getHome(userId: string, cursor?: string, limit = 20) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { cityId: true },
    });
    const [feedResult, suggestedCafes, notificationsUnread] = await Promise.all([
      this.posts.getFeed(userId, cursor, limit),
      user.cityId
        ? this.cafes.list(user.cityId).then((items) => items.slice(0, 6))
        : Promise.resolve([]),
      this.notifications.unreadCount(userId),
    ]);
    return {
      feed: {
        items: feedResult.data,
        nextCursor: feedResult.nextCursor,
      },
      suggestedCafes,
      notificationsUnread,
    };
  }
}
