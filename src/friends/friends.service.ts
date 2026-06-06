import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { FriendRequestStatus, NotificationType } from '@prisma/client';
import { friendshipPair } from '../common/geo/geo.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { RedisService } from '../redis/redis.service';
import { ConnectionBadgesService } from '../gamification/connection-badges.service';

const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
  name: true,
  avatarUrl: true,
} as const;

const MAX_FRIEND_REQUESTS_PER_DAY = 10;

@Injectable()
export class FriendsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    @Inject(forwardRef(() => NotificationsService))
    private notifications: NotificationsService,
    @Inject(forwardRef(() => RealtimeGateway))
    private realtime: RealtimeGateway,
    private connectionBadges: ConnectionBadgesService,
  ) {}

  async friendshipExists(userId: string, otherId: string) {
    const [a, b] = friendshipPair(userId, otherId);
    const f = await this.prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId: a, userBId: b } },
    });
    return !!f;
  }

  private async assertNotBlocked(userId: string, otherId: string) {
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: otherId },
          { blockerId: otherId, blockedId: userId },
        ],
      },
    });
    if (block) throw new ForbiddenException('Cannot interact with this user');
  }

  async sendRequest(senderId: string, receiverId: string) {
    if (senderId === receiverId) {
      throw new BadRequestException('Cannot send request to yourself');
    }
    await this.assertNotBlocked(senderId, receiverId);

    const receiver = await this.prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) throw new NotFoundException('User not found');

    if (await this.friendshipExists(senderId, receiverId)) {
      throw new ConflictException('Already friends');
    }

    const daily = await this.redis.incrFriendRequestDaily(senderId);
    if (daily > MAX_FRIEND_REQUESTS_PER_DAY) {
      throw new HttpException('Daily friend request limit reached', HttpStatus.TOO_MANY_REQUESTS);
    }

    const existing = await this.prisma.friendRequest.findUnique({
      where: { senderId_receiverId: { senderId, receiverId } },
    });
    if (existing?.status === FriendRequestStatus.PENDING) {
      throw new ConflictException('Request already pending');
    }
    if (existing?.status === FriendRequestStatus.DECLINED) {
      const canResend = await this.redis.friendResendCooldown(senderId, receiverId);
      if (!canResend) {
        throw new HttpException('Please wait before sending another request', HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    const sender = await this.prisma.user.findUniqueOrThrow({
      where: { id: senderId },
      select: PUBLIC_USER_SELECT,
    });

    const request = await this.prisma.friendRequest.upsert({
      where: { senderId_receiverId: { senderId, receiverId } },
      create: { senderId, receiverId, status: FriendRequestStatus.PENDING },
      update: {
        status: FriendRequestStatus.PENDING,
        respondedAt: null,
        createdAt: new Date(),
      },
      include: {
        sender: { select: PUBLIC_USER_SELECT },
        receiver: { select: PUBLIC_USER_SELECT },
      },
    });

    await this.notifications.create({
      userId: receiverId,
      type: NotificationType.FRIEND_REQUEST,
      actorId: senderId,
      entityType: 'friend_request',
      entityId: request.id,
    });

    this.realtime.emitToUser(receiverId, 'friend:request', {
      requestId: request.id,
      sender,
    });

    return request;
  }

  async acceptRequest(userId: string, requestId: string) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
      include: {
        sender: { select: PUBLIC_USER_SELECT },
        receiver: { select: PUBLIC_USER_SELECT },
      },
    });
    if (!request || request.receiverId !== userId) {
      throw new NotFoundException('Request not found');
    }
    if (request.status !== FriendRequestStatus.PENDING) {
      throw badRequestStatus('Request is not pending');
    }

    const [userAId, userBId] = friendshipPair(request.senderId, request.receiverId);
    const friendship = await this.prisma.$transaction(async (tx) => {
      await tx.friendRequest.update({
        where: { id: requestId },
        data: { status: FriendRequestStatus.ACCEPTED, respondedAt: new Date() },
      });
      return tx.friendship.upsert({
        where: { userAId_userBId: { userAId, userBId } },
        create: { userAId, userBId },
        update: {},
      });
    });

    const friend =
      request.senderId === userId ? request.receiver : request.sender;

    await this.notifications.create({
      userId: request.senderId,
      type: NotificationType.FRIEND_ACCEPTED,
      actorId: userId,
      entityType: 'friendship',
      entityId: friendship.id,
    });

    this.realtime.emitToUser(request.senderId, 'friend:accepted', {
      friendshipId: friendship.id,
      friend: request.receiverId === userId ? request.receiver : request.sender,
    });
    this.realtime.emitToUser(userId, 'friend:accepted', {
      friendshipId: friendship.id,
      friend,
    });

    await this.connectionBadges.onFriendshipCreated(userId);
    await this.connectionBadges.onFriendshipCreated(request.senderId);

    return { friendship, friend };
  }

  async rejectRequest(userId: string, requestId: string) {
    const request = await this.prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!request || request.receiverId !== userId) {
      throw new NotFoundException('Request not found');
    }
    if (request.status !== FriendRequestStatus.PENDING) {
      throw badRequestStatus('Request is not pending');
    }
    await this.prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: FriendRequestStatus.DECLINED, respondedAt: new Date() },
    });
    this.realtime.emitToUser(request.senderId, 'friend:declined', { requestId });
    return { ok: true };
  }

  async cancelRequest(userId: string, targetUserId: string) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { senderId_receiverId: { senderId: userId, receiverId: targetUserId } },
    });
    if (!request || request.status !== FriendRequestStatus.PENDING) {
      throw new NotFoundException('Pending request not found');
    }
    await this.prisma.friendRequest.update({
      where: { id: request.id },
      data: { status: FriendRequestStatus.CANCELLED, respondedAt: new Date() },
    });
    this.realtime.emitToUser(targetUserId, 'friend:declined', { requestId: request.id });
    return { ok: true };
  }

  async removeFriend(userId: string, otherId: string) {
    const [userAId, userBId] = friendshipPair(userId, otherId);
    const deleted = await this.prisma.friendship.deleteMany({
      where: { userAId, userBId },
    });
    if (deleted.count === 0) throw new NotFoundException('Friendship not found');
    this.realtime.emitToUser(otherId, 'friend:removed', { userId });
    this.realtime.emitToUser(userId, 'friend:removed', { userId: otherId });
    return { ok: true };
  }

  async listFriends(userId: string, cursor?: string, limit = 20) {
    const take = Math.min(limit, 50);
    const friendships = await this.prisma.friendship.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });
    const hasMore = friendships.length > take;
    const page = hasMore ? friendships.slice(0, take) : friendships;
    const friendIds = page.map((f) => (f.userAId === userId ? f.userBId : f.userAId));
    const users = await this.prisma.user.findMany({
      where: { id: { in: friendIds } },
      select: PUBLIC_USER_SELECT,
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const items = page.map((f) => ({
      friendshipId: f.id,
      friend: byId.get(f.userAId === userId ? f.userBId : f.userAId)!,
      createdAt: f.createdAt,
    }));
    return {
      items,
      nextCursor: hasMore ? page[page.length - 1]?.id : null,
      hasMore,
    };
  }

  async listRequests(userId: string) {
    const [incoming, outgoing] = await Promise.all([
      this.prisma.friendRequest.findMany({
        where: { receiverId: userId, status: FriendRequestStatus.PENDING },
        orderBy: { createdAt: 'desc' },
        include: { sender: { select: PUBLIC_USER_SELECT } },
      }),
      this.prisma.friendRequest.findMany({
        where: { senderId: userId, status: FriendRequestStatus.PENDING },
        orderBy: { createdAt: 'desc' },
        include: { receiver: { select: PUBLIC_USER_SELECT } },
      }),
    ]);
    return { incoming, outgoing };
  }

  async getRelationship(viewerId: string, targetId: string) {
    if (viewerId === targetId) return 'self' as const;
    if (await this.friendshipExists(viewerId, targetId)) return 'friends' as const;
    const pending = await this.prisma.friendRequest.findFirst({
      where: {
        status: FriendRequestStatus.PENDING,
        OR: [
          { senderId: viewerId, receiverId: targetId },
          { senderId: targetId, receiverId: viewerId },
        ],
      },
    });
    if (!pending) return 'none' as const;
    return pending.senderId === viewerId ? ('pending_out' as const) : ('pending_in' as const);
  }
}

function badRequestStatus(msg: string): BadRequestException {
  return new BadRequestException(msg);
}
