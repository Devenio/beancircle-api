import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageType, NotificationType } from '@prisma/client';
import { FriendsService } from '../friends/friends.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

type SendMessageInput = {
  type?: string;
  body?: string;
  imageUrl?: string;
  attachment?: {
    url: string;
    name?: string;
    mimeType?: string;
    size?: number;
    durationSec?: number;
  };
  location?: {
    lat: number;
    lng: number;
    label?: string;
  };
  sticker?: string;
  replyToId?: string;
  replyToSnippet?: string;
  forwardedFromId?: string;
  forwardedFromName?: string;
};

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private friendsService: FriendsService,
    @Inject(forwardRef(() => NotificationsService))
    private notifications: NotificationsService,
    @Inject(forwardRef(() => RealtimeGateway))
    private realtime: RealtimeGateway,
  ) {}

  async isMember(conversationId: string, userId: string) {
    const m = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    });
    return !!m;
  }

  async listConversations(userId: string) {
    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId, deletedAt: null },
      include: {
        conversation: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    name: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    const withUnread = await Promise.all(
      memberships.map(async (m) => {
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: m.conversationId,
            senderId: { not: userId },
            deletedAt: null,
            ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
          },
        });
        const lastMessage = m.conversation.messages[0];
        return {
          id: m.conversation.id,
          createdAt: m.conversation.createdAt,
          updatedAt: m.conversation.updatedAt,
          otherMember: m.conversation.members.find((x) => x.userId !== userId)
            ?.user,
          lastMessage: lastMessage
            ? this.serializeMessage(lastMessage)
            : undefined,
          unreadCount,
          pinned: m.pinned,
          muted: m.muted,
          lastReadAt: m.lastReadAt,
          lastReadMessageId: m.lastReadMessageId,
        };
      }),
    );

    // Server-authoritative ordering: pinned first, then most recent activity.
    return withUnread.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const aTime = new Date(
        a.lastMessage?.createdAt ?? a.updatedAt,
      ).getTime();
      const bTime = new Date(
        b.lastMessage?.createdAt ?? b.updatedAt,
      ).getTime();
      return bTime - aTime;
    });
  }

  async setConversationPinned(
    conversationId: string,
    userId: string,
    pinned: boolean,
  ) {
    await this.ensureMember(conversationId, userId);
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { pinned },
    });
    return { conversationId, pinned };
  }

  async setConversationMuted(
    conversationId: string,
    userId: string,
    muted: boolean,
  ) {
    await this.ensureMember(conversationId, userId);
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { muted },
    });
    return { conversationId, muted };
  }

  async findOrCreate(userId: string, participantId: string) {
    if (userId === participantId) {
      throw new BadRequestException('Cannot message yourself');
    }
    const blocked = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: participantId },
          { blockerId: participantId, blockedId: userId },
        ],
      },
    });
    if (blocked) throw new ForbiddenException('Cannot message this user');
    const allowWithoutFriend =
      this.config.get<string>('ALLOW_DM_WITHOUT_FRIENDSHIP') === 'true';
    if (!allowWithoutFriend) {
      const friends = await this.friendsService.friendshipExists(userId, participantId);
      if (!friends) {
        throw new ForbiddenException('Messaging requires friendship');
      }
    }
    const existing = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: participantId } } },
        ],
      },
      include: { members: true },
    });
    if (existing && existing.members.length === 2) {
      await this.prisma.conversationMember.updateMany({
        where: { conversationId: existing.id, userId, deletedAt: { not: null } },
        data: { deletedAt: null },
      });
      return existing;
    }

    return this.prisma.conversation.create({
      data: {
        members: {
          create: [{ userId }, { userId: participantId }],
        },
      },
      include: { members: true },
    });
  }

  async getMessages(
    conversationId: string,
    userId: string,
    cursor?: string,
    limit = 30,
  ) {
    await this.ensureMember(conversationId, userId);
    const items = await this.prisma.message.findMany({
      where: {
        conversationId,
        hides: { none: { userId } },
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
        reactions: true,
      },
    });
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    return {
      data: data.reverse().map((item) => this.serializeMessage(item)),
      nextCursor: hasMore ? data[0]?.id : null,
    };
  }

  private parseType(type?: string): MessageType {
    if (!type) return MessageType.TEXT;
    const normalized = type.toUpperCase() as MessageType;
    if (normalized in MessageType) {
      return normalized;
    }
    throw new BadRequestException('Invalid message type');
  }

  private serializeMessage<
    T extends {
      id: string;
      senderId: string;
      type: MessageType;
      body: string | null;
      imageUrl: string | null;
      attachmentUrl: string | null;
      attachmentName: string | null;
      attachmentMimeType: string | null;
      attachmentSize: number | null;
      attachmentDurationSec: number | null;
      locationLat: number | null;
      locationLng: number | null;
      locationLabel: string | null;
      sticker: string | null;
      replyToId: string | null;
      replyToSnippet: string | null;
      forwardedFromId?: string | null;
      forwardedFromName?: string | null;
      editedAt: Date | null;
      deletedAt: Date | null;
      isPinned: boolean;
      seenBy: string[];
      createdAt: Date;
      sender?: {
        id: string;
        username: string | null;
        name?: string | null;
        avatarUrl?: string | null;
      } | null;
    },
  >(message: T) {
    const type = message.type.toLowerCase();
    return {
      id: message.id,
      senderId: message.senderId,
      sender: message.sender ?? {
        id: message.senderId,
        username: null,
      },
      type,
      body: message.body,
      imageUrl: message.imageUrl,
      attachment: message.attachmentUrl
        ? {
            url: message.attachmentUrl,
            name: message.attachmentName ?? undefined,
            mimeType: message.attachmentMimeType ?? undefined,
            size: message.attachmentSize ?? undefined,
            durationSec: message.attachmentDurationSec ?? undefined,
          }
        : undefined,
      location:
        message.locationLat != null && message.locationLng != null
          ? {
              lat: message.locationLat,
              lng: message.locationLng,
              label: message.locationLabel ?? undefined,
            }
          : undefined,
      sticker: message.sticker ?? undefined,
      replyToId: message.replyToId ?? undefined,
      replyToSnippet: message.replyToSnippet ?? undefined,
      forwardedFromId: message.forwardedFromId ?? undefined,
      forwardedFromName: message.forwardedFromName ?? undefined,
      editedAt: message.editedAt ?? undefined,
      deletedAt: message.deletedAt ?? undefined,
      pinned: message.isPinned,
      seenBy: message.seenBy,
      reactions:
        'reactions' in message && Array.isArray(message.reactions)
          ? this.groupReactions(
              message.reactions as { emoji: string; userId: string }[],
            )
          : [],
      createdAt: message.createdAt,
    };
  }

  private groupReactions(reactions: { emoji: string; userId: string }[]) {
    const map = new Map<string, string[]>();
    for (const r of reactions) {
      const list = map.get(r.emoji) ?? [];
      list.push(r.userId);
      map.set(r.emoji, list);
    }
    return [...map.entries()].map(([emoji, userIds]) => ({
      emoji,
      count: userIds.length,
      userIds,
    }));
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    data: SendMessageInput,
  ) {
    await this.ensureMember(conversationId, senderId);
    await this.ensureNotBlocked(conversationId, senderId);
    const messageType = this.parseType(data.type);
    const body = data.body?.trim();
    const hasText = Boolean(body);
    const hasAttachment = Boolean(data.imageUrl || data.attachment?.url);
    const hasLocation = Boolean(data.location);
    const hasSticker = Boolean(data.sticker);
    if (!hasText && !hasAttachment && !hasLocation && !hasSticker) {
      throw new BadRequestException('Message content is required');
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        type: messageType,
        body,
        imageUrl:
          data.imageUrl ??
          (messageType === MessageType.IMAGE
            ? data.attachment?.url
            : undefined),
        attachmentUrl: data.attachment?.url,
        attachmentName: data.attachment?.name,
        attachmentMimeType: data.attachment?.mimeType,
        attachmentSize: data.attachment?.size,
        attachmentDurationSec: data.attachment?.durationSec,
        locationLat: data.location?.lat,
        locationLng: data.location?.lng,
        locationLabel: data.location?.label,
        sticker: data.sticker,
        replyToId: data.replyToId,
        replyToSnippet: data.replyToSnippet,
        forwardedFromId: data.forwardedFromId,
        forwardedFromName: data.forwardedFromName,
        seenBy: [senderId],
      },
      include: {
        sender: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    await this.prisma.conversationMember.updateMany({
      where: { conversationId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId, NOT: { userId: senderId } },
    });
    for (const m of members) {
      await this.notifications.create({
        userId: m.userId,
        type: NotificationType.NEW_MESSAGE,
        actorId: senderId,
        entityType: 'conversation',
        entityId: conversationId,
      });
    }
    const payload = this.serializeMessage(message);
    this.realtime.emitToConversation(conversationId, 'message:new', payload);
    // Notify every member's personal room so inboxes update live even when
    // they are not currently inside the conversation room.
    for (const m of members) {
      this.realtime.emitToUser(m.userId, 'conversation:bump', {
        conversationId,
        lastMessage: payload,
      });
    }
    return payload;
  }

  async markRead(conversationId: string, userId: string, messageId?: string) {
    await this.ensureMember(conversationId, userId);
    const target = messageId
      ? await this.prisma.message.findFirst({
          where: { id: messageId, conversationId },
          select: { id: true, createdAt: true },
        })
      : await this.prisma.message.findFirst({
          where: { conversationId },
          orderBy: { createdAt: 'desc' },
          select: { id: true, createdAt: true },
        });
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: {
        lastReadAt: target?.createdAt ?? new Date(),
        lastReadMessageId: target?.id ?? null,
      },
    });
    return {
      conversationId,
      userId,
      lastReadAt: target?.createdAt ?? null,
      lastReadMessageId: target?.id ?? null,
      unreadCount: 0,
    };
  }

  async forwardMessage(
    userId: string,
    sourceMessageId: string,
    targetConversationIds: string[],
  ) {
    const source = await this.prisma.message.findUnique({
      where: { id: sourceMessageId },
      include: {
        sender: { select: { id: true, name: true, username: true } },
      },
    });
    if (!source) throw new NotFoundException('Message not found');
    await this.ensureMember(source.conversationId, userId);
    if (source.deletedAt) {
      throw new BadRequestException('Cannot forward a deleted message');
    }

    const uniqueTargets = [...new Set(targetConversationIds)].filter(Boolean);
    if (uniqueTargets.length === 0) {
      throw new BadRequestException('No target conversations provided');
    }

    const originName =
      source.forwardedFromName ??
      source.sender?.name ??
      source.sender?.username ??
      null;
    const originId = source.forwardedFromId ?? source.senderId;

    const results = await Promise.all(
      uniqueTargets.map(async (targetId) => {
        const member = await this.isMember(targetId, userId);
        if (!member) {
          return { conversationId: targetId, ok: false, error: 'forbidden' };
        }
        try {
          const message = await this.sendMessage(targetId, userId, {
            type: source.type.toLowerCase(),
            body: source.body ?? undefined,
            imageUrl: source.imageUrl ?? undefined,
            attachment: source.attachmentUrl
              ? {
                  url: source.attachmentUrl,
                  name: source.attachmentName ?? undefined,
                  mimeType: source.attachmentMimeType ?? undefined,
                  size: source.attachmentSize ?? undefined,
                  durationSec: source.attachmentDurationSec ?? undefined,
                }
              : undefined,
            location:
              source.locationLat != null && source.locationLng != null
                ? {
                    lat: source.locationLat,
                    lng: source.locationLng,
                    label: source.locationLabel ?? undefined,
                  }
                : undefined,
            sticker: source.sticker ?? undefined,
            forwardedFromId: originId,
            forwardedFromName: originName ?? undefined,
          });
          return { conversationId: targetId, ok: true, message };
        } catch {
          return { conversationId: targetId, ok: false, error: 'failed' };
        }
      }),
    );

    return {
      sourceMessageId,
      results,
      delivered: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
    };
  }

  async editMessage(
    conversationId: string,
    messageId: string,
    userId: string,
    body: string,
  ) {
    await this.ensureMember(conversationId, userId);
    const existing = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
    });
    if (!existing || existing.conversationId !== conversationId) {
      throw new NotFoundException('Message not found');
    }
    if (existing.senderId !== userId) {
      throw new ForbiddenException('Cannot edit this message');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        body: body.trim(),
        editedAt: new Date(),
      },
      include: {
        sender: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
    });
    const payload = this.serializeMessage(updated);
    this.realtime.emitToConversation(conversationId, 'message:edited', payload);
    return payload;
  }

  async deleteMessage(
    conversationId: string,
    messageId: string,
    userId: string,
    forEveryone = false,
  ) {
    await this.ensureMember(conversationId, userId);
    const existing = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
    });
    if (!existing || existing.conversationId !== conversationId) {
      throw new NotFoundException('Message not found');
    }

    if (forEveryone) {
      if (existing.senderId !== userId) {
        throw new ForbiddenException('Only the sender can delete for everyone');
      }

      const updated = await this.prisma.message.update({
        where: { id: messageId },
        data: {
          body: null,
          deletedAt: new Date(),
        },
        include: {
          sender: {
            select: { id: true, username: true, name: true, avatarUrl: true },
          },
        },
      });
      const payload = this.serializeMessage(updated);
      this.realtime.emitToConversation(
        conversationId,
        'message:deleted',
        payload,
      );
      return payload;
    }

    await this.prisma.messageHide.upsert({
      where: { messageId_userId: { messageId, userId } },
      create: { messageId, userId },
      update: { hiddenAt: new Date() },
    });
    this.realtime.emitToUser(userId, 'message:hidden', {
      conversationId,
      messageId,
    });
    return { conversationId, messageId, scope: 'me' as const };
  }

  async setMessagePinned(
    conversationId: string,
    messageId: string,
    userId: string,
    pinned?: boolean,
  ) {
    await this.ensureMember(conversationId, userId);
    const existing = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
    });
    if (!existing || existing.conversationId !== conversationId) {
      throw new NotFoundException('Message not found');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isPinned: typeof pinned === 'boolean' ? pinned : !existing.isPinned,
      },
      include: {
        sender: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
    });
    const payload = this.serializeMessage(updated);
    this.realtime.emitToConversation(conversationId, 'message:pinned', payload);
    return payload;
  }

  async markMessageSeen(
    conversationId: string,
    messageId: string,
    userId: string,
  ) {
    await this.ensureMember(conversationId, userId);
    const existing = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
    });
    if (!existing || existing.conversationId !== conversationId) {
      throw new NotFoundException('Message not found');
    }

    if (existing.seenBy.includes(userId)) {
      return { seen: true, message: this.serializeMessage(existing) };
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        seenBy: [...existing.seenBy, userId],
      },
      include: {
        sender: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
    });
    const payload = this.serializeMessage(updated);
    this.realtime.emitToConversation(conversationId, 'message:seen', {
      conversationId,
      messageId,
      userId,
      message: payload,
    });
    return { seen: true, message: payload };
  }

  async toggleMessageReaction(
    conversationId: string,
    messageId: string,
    userId: string,
    emoji: string,
  ) {
    await this.ensureMember(conversationId, userId);
    const normalizedEmoji = emoji?.trim();
    if (!normalizedEmoji || [...normalizedEmoji].length > 8) {
      throw new BadRequestException('Invalid reaction');
    }
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message || message.conversationId !== conversationId) {
      throw new NotFoundException('Message not found');
    }

    const existing = await this.prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: { messageId, userId, emoji: normalizedEmoji },
      },
    });
    if (existing) {
      await this.prisma.messageReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.messageReaction.create({
        data: { messageId, userId, emoji: normalizedEmoji },
      });
    }

    const reactions = await this.prisma.messageReaction.findMany({
      where: { messageId },
    });
    const payload = {
      conversationId,
      messageId,
      reactions: this.groupReactions(reactions),
    };
    this.realtime.emitToConversation(
      conversationId,
      'message:reaction',
      payload,
    );
    return payload;
  }

  private async ensureMember(conversationId: string, userId: string) {
    const ok = await this.isMember(conversationId, userId);
    if (!ok) throw new NotFoundException('Conversation not found');
  }

  private async ensureNotBlocked(conversationId: string, senderId: string) {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    const peerId = members.find((m) => m.userId !== senderId)?.userId;
    if (!peerId) return;
    const blocked = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: senderId, blockedId: peerId },
          { blockerId: peerId, blockedId: senderId },
        ],
      },
    });
    if (blocked) throw new ForbiddenException('Cannot message this user');
  }

  async deleteConversation(
    conversationId: string,
    userId: string,
    forEveryone = false,
  ) {
    await this.ensureMember(conversationId, userId);

    if (forEveryone) {
      const now = new Date();
      await this.prisma.message.updateMany({
        where: { conversationId, deletedAt: null },
        data: { deletedAt: now, body: null },
      });
      await this.prisma.conversationMember.updateMany({
        where: { conversationId },
        data: { deletedAt: now },
      });
      this.realtime.emitToConversation(conversationId, 'conversation:deleted', {
        conversationId,
        deletedAt: now.toISOString(),
      });
      return { conversationId, scope: 'everyone' as const, deleted: true };
    }

    const deletedAt = new Date();
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { deletedAt },
    });
    this.realtime.emitToUser(userId, 'conversation:hidden', {
      conversationId,
      deletedAt: deletedAt.toISOString(),
    });
    return { conversationId, scope: 'me' as const, deleted: true };
  }

  async getConversationProfile(conversationId: string, userId: string) {
    await this.ensureMember(conversationId, userId);
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            bio: true,
            avatarUrl: true,
            createdAt: true,
            lastSeenAt: true,
            showLastSeen: true,
          },
        },
      },
    });
    const peer = members.find((m) => m.userId !== userId)?.user;
    if (!peer) throw new NotFoundException('Peer not found');

    const [mutualFriends, sharedSquads, mediaCount, filesCount, linksCount, mutedMembership] =
      await Promise.all([
        this.countMutualFriends(userId, peer.id),
        this.countSharedSquads(userId, peer.id),
        this.prisma.message.count({
          where: {
            conversationId,
            deletedAt: null,
            type: { in: ['IMAGE', 'VIDEO'] },
          },
        }),
        this.prisma.message.count({
          where: {
            conversationId,
            deletedAt: null,
            type: 'FILE',
          },
        }),
        this.prisma.message.count({
          where: {
            conversationId,
            deletedAt: null,
            body: { contains: 'http' },
          },
        }),
        this.prisma.conversationMember.findUnique({
          where: { conversationId_userId: { conversationId, userId } },
          select: { muted: true },
        }),
      ]);

    return {
      user: peer,
      mutualFriendsCount: mutualFriends,
      sharedGroupsCount: sharedSquads,
      sharedMediaCount: mediaCount,
      sharedFilesCount: filesCount,
      sharedLinksCount: linksCount,
      muted: mutedMembership?.muted ?? false,
    };
  }

  private async countMutualFriends(userA: string, userB: string) {
    const [aFollows, bFollows] = await Promise.all([
      this.prisma.userFollow.findMany({
        where: { followerId: userA },
        select: { followingId: true },
      }),
      this.prisma.userFollow.findMany({
        where: { followerId: userB },
        select: { followingId: true },
      }),
    ]);
    const aSet = new Set(aFollows.map((f) => f.followingId));
    return bFollows.filter((f) => aSet.has(f.followingId)).length;
  }

  private async countSharedSquads(userA: string, userB: string) {
    const [aSquads, bSquads] = await Promise.all([
      this.prisma.squadMember.findMany({
        where: { userId: userA },
        select: { squadId: true },
      }),
      this.prisma.squadMember.findMany({
        where: { userId: userB },
        select: { squadId: true },
      }),
    ]);
    const aSet = new Set(aSquads.map((s) => s.squadId));
    return bSquads.filter((s) => aSet.has(s.squadId)).length;
  }

  async getConversationShared(
    conversationId: string,
    userId: string,
    kind: 'media' | 'files' | 'links' | 'groups',
    cursor?: string,
    limit = 24,
  ) {
    if (!['media', 'files', 'links', 'groups'].includes(kind)) {
      throw new BadRequestException('Invalid shared content type');
    }
    await this.ensureMember(conversationId, userId);
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    const peerId = members.find((m) => m.userId !== userId)?.userId;
    if (!peerId) throw new NotFoundException('Peer not found');

    if (kind === 'groups') {
      const [aSquads, bSquads] = await Promise.all([
        this.prisma.squadMember.findMany({
          where: { userId },
          select: { squadId: true },
        }),
        this.prisma.squadMember.findMany({
          where: { userId: peerId },
          select: { squadId: true },
        }),
      ]);
      const sharedIds = bSquads
        .map((s) => s.squadId)
        .filter((id) => aSquads.some((a) => a.squadId === id));
      const squads = await this.prisma.squad.findMany({
        where: { id: { in: sharedIds } },
        orderBy: { name: 'asc' },
        take: 50,
        select: {
          id: true,
          name: true,
          slug: true,
          emoji: true,
          memberCount: true,
          coverUrl: true,
        },
      });
      return { data: squads, nextCursor: null };
    }

    const typeFilter =
      kind === 'media'
        ? { type: { in: [MessageType.IMAGE, MessageType.VIDEO] as MessageType[] } }
        : kind === 'files'
          ? { type: MessageType.FILE }
          : { body: { contains: 'http' } };

    const items = await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        ...typeFilter,
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        body: true,
        imageUrl: true,
        attachmentUrl: true,
        attachmentName: true,
        attachmentMimeType: true,
        attachmentSize: true,
        createdAt: true,
      },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;

    const data = page
      .map((msg) => {
        if (kind === 'links') {
          const urls = (msg.body ?? '').match(/https?:\/\/[^\s]+/gi) ?? [];
          return {
            messageId: msg.id,
            createdAt: msg.createdAt.toISOString(),
            url: urls[0] ?? '',
            label: urls[0] ?? '',
          };
        }
        if (kind === 'media') {
          const url = msg.imageUrl ?? msg.attachmentUrl ?? '';
          return {
            messageId: msg.id,
            createdAt: msg.createdAt.toISOString(),
            type: msg.type.toLowerCase(),
            url,
            thumbnailUrl: msg.type === MessageType.IMAGE ? url : undefined,
            name: msg.attachmentName ?? undefined,
          };
        }
        return {
          messageId: msg.id,
          createdAt: msg.createdAt.toISOString(),
          url: msg.attachmentUrl ?? '',
          name: msg.attachmentName ?? 'File',
          mimeType: msg.attachmentMimeType ?? undefined,
          size: msg.attachmentSize ?? undefined,
        };
      })
      .filter((item) => (kind === 'links' ? Boolean(item.url) : kind === 'media' ? Boolean(item.url) : Boolean(item.url)));

    return {
      data,
      nextCursor: hasMore ? page[page.length - 1]?.id : null,
    };
  }
}
