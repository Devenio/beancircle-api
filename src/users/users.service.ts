import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RedisService } from '../redis/redis.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const userSelect = {
  id: true,
  username: true,
  name: true,
  bio: true,
  avatarUrl: true,
  cityId: true,
  countryId: true,
  role: true,
  postsCount: true,
  followersCount: true,
  followingCount: true,
  createdAt: true,
  city: true,
};

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private redis: RedisService,
  ) {}

  getMe(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { ...userSelect, phone: true, email: true },
    });
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    if (dto.username) {
      const taken = await this.prisma.user.findFirst({
        where: { username: dto.username, NOT: { id: userId } },
      });
      if (taken) throw new ConflictException('Username taken');
    }
    if (dto.cityId) {
      const city = await this.prisma.city.findUnique({ where: { id: dto.cityId } });
      if (!city) throw new BadRequestException('Invalid city');
      return this.prisma.user.update({
        where: { id: userId },
        data: { ...dto, countryId: city.countryId },
        select: userSelect,
      });
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: userSelect,
    });
  }

  async getByUsername(username: string, viewerId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        ...userSelect,
        favoriteCafes: {
          include: { cafe: { include: { photos: { take: 1 } } } },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    let isFollowing = false;
    if (viewerId && viewerId !== user.id) {
      const follow = await this.prisma.userFollow.findUnique({
        where: {
          followerId_followingId: { followerId: viewerId, followingId: user.id },
        },
      });
      isFollowing = !!follow;
    }
    return { ...user, isFollowing, isSelf: viewerId === user.id };
  }

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself');
    }
    const target = await this.prisma.user.findUnique({ where: { id: followingId } });
    if (!target) throw new NotFoundException('User not found');
    const existing = await this.prisma.userFollow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    if (existing) {
      return { following: true };
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.userFollow.create({ data: { followerId, followingId } });
      await tx.user.update({
        where: { id: followerId },
        data: { followingCount: { increment: 1 } },
      });
      await tx.user.update({
        where: { id: followingId },
        data: { followersCount: { increment: 1 } },
      });
    });
    await this.notifications.create({
      userId: followingId,
      type: NotificationType.NEW_FOLLOWER,
      actorId: followerId,
      entityType: 'user',
      entityId: followerId,
    });
    return { following: true };
  }

  async unfollow(followerId: string, followingId: string) {
    const deleted = await this.prisma.userFollow.deleteMany({
      where: { followerId, followingId },
    });
    if (deleted.count) {
      await this.prisma.user.update({
        where: { id: followerId },
        data: { followingCount: { decrement: 1 } },
      });
      await this.prisma.user.update({
        where: { id: followingId },
        data: { followersCount: { decrement: 1 } },
      });
    }
    return { following: false };
  }

  async getFavoriteCafes(userId: string) {
    return this.prisma.favoriteCafe.findMany({
      where: { userId },
      include: { cafe: { include: { photos: { take: 1 } } } },
    });
  }

  async addFavoriteCafe(userId: string, cafeId: string) {
    const cafe = await this.prisma.cafe.findUniqueOrThrow({ where: { id: cafeId } });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.prisma.favoriteCafe.upsert({
      where: { userId_cafeId: { userId, cafeId } },
      create: { userId, cafeId, cityId: user.cityId ?? cafe.cityId },
      update: {},
      include: { cafe: true },
    });
  }

  async removeFavoriteCafe(userId: string, cafeId: string) {
    await this.prisma.favoriteCafe.deleteMany({ where: { userId, cafeId } });
    return { removed: true };
  }

  listCities() {
    return this.prisma.city.findMany({
      include: { country: true },
      orderBy: { name: 'asc' },
    });
  }

  async getPresence(targetUserId: string, viewerId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, lastSeenAt: true, showLastSeen: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const online = await this.redis.isOnline(targetUserId);
    const isSelf = viewerId === targetUserId;

    if (!user.showLastSeen && !isSelf) {
      return { userId: targetUserId, online, lastSeenAt: null, hidden: true };
    }

    return {
      userId: targetUserId,
      online,
      lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      hidden: false,
    };
  }

  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }
    const target = await this.prisma.user.findUnique({ where: { id: blockedId } });
    if (!target) throw new NotFoundException('User not found');
    await this.prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId },
      update: {},
    });
    return { blocked: true };
  }

  async unblockUser(blockerId: string, blockedId: string) {
    await this.prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
    return { blocked: false };
  }

  async isBlockedEitherWay(userA: string, userB: string) {
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userA, blockedId: userB },
          { blockerId: userB, blockedId: userA },
        ],
      },
    });
    return !!block;
  }
}
