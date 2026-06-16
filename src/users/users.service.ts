import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, VisibilityLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RedisService } from '../redis/redis.service';
import { friendshipPair } from '../common/geo/geo.util';
import { UpdateProfileDto } from './dto/update-profile.dto';

const userSelect = {
  id: true,
  username: true,
  name: true,
  bio: true,
  avatarUrl: true,
  favoriteCoffee: true,
  website: true,
  socialLinks: true,
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

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        ...userSelect,
        phone: true,
        email: true,
        onboarding: {
          select: {
            currentStep: true,
            completedSteps: true,
            skippedSteps: true,
            completedAt: true,
          },
        },
        cafeStaff: {
          where: { role: 'OWNER' },
          select: { cafeId: true },
          take: 1,
        },
      },
    });
    const { cafeStaff, ...rest } = user;
    return { ...rest, isCafeOwner: cafeStaff.length > 0 };
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

  async checkUsernameAvailable(username: string, requesterId: string) {
    const taken = await this.prisma.user.findFirst({
      where: { username, NOT: { id: requesterId } },
      select: { id: true },
    });
    return { available: !taken };
  }

  async getByUsername(username: string, viewerId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        ...userSelect,
        favoriteCafes: {
          include: { cafe: { include: { photos: { take: 1 } } } },
        },
        settings: { select: { profileVisibility: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const isSelf = viewerId === user.id;
    let isFollowing = false;
    if (viewerId && !isSelf) {
      const follow = await this.prisma.userFollow.findUnique({
        where: {
          followerId_followingId: { followerId: viewerId, followingId: user.id },
        },
      });
      isFollowing = !!follow;
    }

    const { settings, favoriteCafes, ...profile } = user;
    const visibility = settings?.profileVisibility ?? VisibilityLevel.EVERYONE;
    const visible = await this.viewerPassesVisibility(
      visibility,
      user.id,
      viewerId,
    );

    // Restricted profiles expose only the public identity card so the viewer
    // can still find/follow the user without seeing private detail.
    if (!visible) {
      return {
        id: profile.id,
        username: profile.username,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        city: profile.city,
        followersCount: profile.followersCount,
        followingCount: profile.followingCount,
        isFollowing,
        isSelf,
        restricted: true,
      };
    }

    return {
      ...profile,
      favoriteCafes,
      isFollowing,
      isSelf,
      restricted: false,
    };
  }

  async follow(followerId: string, followingId: string) {
    throw new BadRequestException(
      'Follow is deprecated. Use POST /friends/request instead.',
    );
  }

  async unfollow(_followerId: string, _followingId: string) {
    throw new BadRequestException(
      'Unfollow is deprecated. Use DELETE /friends/remove instead.',
    );
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

  /** True when `viewerId` and `ownerId` are confirmed friends ("contacts"). */
  private async isContact(viewerId: string, ownerId: string): Promise<boolean> {
    const [a, b] = friendshipPair(viewerId, ownerId);
    const friendship = await this.prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId: a, userBId: b } },
      select: { id: true },
    });
    return !!friendship;
  }

  /**
   * Resolves a `VisibilityLevel` for a given viewer: EVERYONE always passes,
   * NOBODY never does, CONTACTS only for confirmed friends. The owner viewing
   * themselves always passes.
   */
  private async viewerPassesVisibility(
    level: VisibilityLevel,
    ownerId: string,
    viewerId?: string,
  ): Promise<boolean> {
    if (viewerId === ownerId) return true;
    if (level === VisibilityLevel.EVERYONE) return true;
    if (level === VisibilityLevel.NOBODY) return false;
    if (!viewerId) return false;
    return this.isContact(viewerId, ownerId);
  }

  async getPresence(targetUserId: string, viewerId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        lastSeenAt: true,
        showLastSeen: true,
        settings: {
          select: {
            lastSeenVisibility: true,
            onlineStatusVisibility: true,
            showOnlineStatus: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const isSelf = viewerId === targetUserId;
    const connected = await this.redis.isOnline(targetUserId);

    // Online status: master toggle off hides it for everyone but the user;
    // otherwise honor the per-audience visibility level.
    const onlineLevel =
      user.settings?.onlineStatusVisibility ?? VisibilityLevel.EVERYONE;
    const onlineAllowed =
      (user.settings?.showOnlineStatus ?? true) &&
      (await this.viewerPassesVisibility(onlineLevel, targetUserId, viewerId));
    const online = isSelf ? connected : onlineAllowed && connected;

    // Last seen: legacy boolean plus the per-audience visibility level.
    const lastSeenLevel =
      user.settings?.lastSeenVisibility ?? VisibilityLevel.EVERYONE;
    const lastSeenAllowed =
      user.showLastSeen &&
      (await this.viewerPassesVisibility(lastSeenLevel, targetUserId, viewerId));

    if (!isSelf && !lastSeenAllowed) {
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

  async getBlockStatus(viewerId: string, targetUserId: string) {
    if (viewerId === targetUserId) {
      return { blocked: false, blockedByYou: false, blockedByPeer: false };
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found');

    const [byYou, byPeer] = await Promise.all([
      this.prisma.userBlock.findUnique({
        where: {
          blockerId_blockedId: { blockerId: viewerId, blockedId: targetUserId },
        },
      }),
      this.prisma.userBlock.findUnique({
        where: {
          blockerId_blockedId: { blockerId: targetUserId, blockedId: viewerId },
        },
      }),
    ]);

    return {
      blocked: Boolean(byYou || byPeer),
      blockedByYou: Boolean(byYou),
      blockedByPeer: Boolean(byPeer),
    };
  }
}
