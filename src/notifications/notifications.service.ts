import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushPayload, PushService } from '../push/push.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

type CreatedNotification = {
  type: NotificationType;
  entityType: string | null;
  entityId: string | null;
  payload: unknown;
  actor: { name: string | null; username: string | null } | null;
};

/** Notification types too high-frequency to be worth a push (handled elsewhere). */
const PUSH_DENYLIST = new Set<NotificationType>([
  NotificationType.NEW_MESSAGE,
  NotificationType.SQUAD_MESSAGE,
  NotificationType.BEAN_REACTION,
  NotificationType.BEAN_REBEAN,
]);

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private push: PushService,
    @Inject(forwardRef(() => RealtimeGateway))
    private realtime: RealtimeGateway,
  ) {}

  async create(data: {
    userId: string;
    type: NotificationType;
    actorId?: string;
    entityType?: string;
    entityId?: string;
    payload?: object;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        actorId: data.actorId,
        entityType: data.entityType,
        entityId: data.entityId,
        payload: data.payload,
      },
      include: {
        actor: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
    });
    this.realtime.emitToUser(data.userId, 'notification:new', notification);

    // Best-effort web push — never let delivery failures break notification writes.
    const pushPayload = this.buildPushPayload(notification);
    if (pushPayload) {
      void this.push
        .sendToUser(data.userId, pushPayload)
        .catch(() => undefined);
    }

    return notification;
  }

  /** Map a notification to a push payload, or null to skip delivery. */
  private buildPushPayload(n: CreatedNotification): PushPayload | null {
    if (PUSH_DENYLIST.has(n.type)) return null;

    const actor = n.actor?.name ?? n.actor?.username ?? 'Someone';
    const payload = (n.payload ?? {}) as Record<string, unknown>;
    const entityUrl = this.entityUrl(n.entityType, n.entityId);

    switch (n.type) {
      case NotificationType.NEW_LIKE:
        return {
          title: 'New like ❤️',
          body: `${actor} liked your ${n.entityType ?? 'post'}`,
          url: entityUrl ?? '/notifications',
          tag: n.type,
        };
      case NotificationType.NEW_COMMENT:
      case NotificationType.BEAN_REPLY:
        return {
          title: 'New reply 💬',
          body: `${actor} replied to you`,
          url: entityUrl ?? '/notifications',
          tag: n.type,
        };
      case NotificationType.BEAN_MENTION:
        return {
          title: 'You were mentioned',
          body: `${actor} mentioned you`,
          url: entityUrl ?? '/notifications',
          tag: n.type,
        };
      case NotificationType.NEW_FOLLOWER:
        return {
          title: 'New follower',
          body: `${actor} started following you`,
          url: '/notifications',
          tag: n.type,
        };
      case NotificationType.FRIEND_REQUEST:
        return {
          title: 'Friend request 👋',
          body: `${actor} sent you a friend request`,
          url: '/notifications',
          tag: n.type,
        };
      case NotificationType.FRIEND_ACCEPTED:
        return {
          title: 'Friend request accepted',
          body: `${actor} accepted your friend request`,
          url: '/notifications',
          tag: n.type,
        };
      case NotificationType.GIFT_COFFEE:
        return {
          title: 'You got a coffee ☕',
          body: `${actor} sent you a coffee`,
          url: '/notifications',
          tag: n.type,
        };
      case NotificationType.CHALLENGE_COMPLETE: {
        const challengeTitle =
          typeof payload.challengeTitle === 'string'
            ? payload.challengeTitle
            : 'a challenge';
        const points =
          typeof payload.points === 'number' ? payload.points : null;
        return {
          title: 'Challenge complete! 🎉',
          body: points
            ? `You finished "${challengeTitle}" — +${points} pts`
            : `You finished "${challengeTitle}"`,
          url: '/community',
          tag: n.type,
        };
      }
      case NotificationType.CAFE_OWNERSHIP_APPROVED:
        return {
          title: "You're verified! 🎉",
          body: 'Your cafe ownership was approved. Cafe OS is now unlocked.',
          url: '/owner',
          tag: n.type,
        };
      case NotificationType.CAFE_OWNERSHIP_REJECTED:
        return {
          title: 'Ownership request update',
          body: 'We reviewed your cafe ownership request. Tap to learn more.',
          url: '/owner',
          tag: n.type,
        };
      default:
        return {
          title: 'BeanCircle',
          body: `${actor} sent you a notification`,
          url: '/notifications',
          tag: n.type,
        };
    }
  }

  private entityUrl(
    entityType: string | null,
    entityId: string | null,
  ): string | undefined {
    if (!entityId) return undefined;
    switch (entityType) {
      case 'bean':
        return `/bean/${entityId}`;
      case 'post':
        return `/post/${entityId}`;
      case 'cafe':
        return `/cafe/${entityId}`;
      case 'event':
        return `/events/${entityId}`;
      default:
        return undefined;
    }
  }

  async list(userId: string, cursor?: string, limit = 20) {
    const items = await this.prisma.notification.findMany({
      where: { userId },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
    });
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    return {
      data,
      nextCursor: hasMore ? data[data.length - 1]?.id : null,
    };
  }

  async markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }
}
