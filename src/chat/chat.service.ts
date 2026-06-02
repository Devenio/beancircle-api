import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { MessageType, NotificationType, ReactionEmoji } from '@prisma/client';
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
};

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
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
      where: { userId },
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
      orderBy: { conversation: { updatedAt: 'desc' } },
    });
    return memberships.map((m) => ({
      ...m.conversation,
      otherMember: m.conversation.members.find((x) => x.userId !== userId)
        ?.user,
      lastMessage: m.conversation.messages[0],
    }));
  }

  async findOrCreate(userId: string, participantId: string) {
    if (userId === participantId) {
      throw new BadRequestException('Cannot message yourself');
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
    if (existing && existing.members.length === 2) return existing;

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
      where: { conversationId },
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
      editedAt: message.editedAt ?? undefined,
      deletedAt: message.deletedAt ?? undefined,
      pinned: message.isPinned,
      seenBy: message.seenBy,
      reactions:
        'reactions' in message && Array.isArray(message.reactions)
          ? this.groupReactions(
              message.reactions as { emoji: ReactionEmoji; userId: string }[],
            )
          : [],
      createdAt: message.createdAt,
    };
  }

  private groupReactions(
    reactions: { emoji: ReactionEmoji; userId: string }[],
  ) {
    const map = new Map<ReactionEmoji, number>();
    for (const r of reactions) {
      map.set(r.emoji, (map.get(r.emoji) ?? 0) + 1);
    }
    return [...map.entries()].map(([emoji, count]) => ({ emoji, count }));
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    data: SendMessageInput,
  ) {
    await this.ensureMember(conversationId, senderId);
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
    return payload;
  }

  async markRead(conversationId: string, userId: string) {
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
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
      throw new ForbiddenException('Cannot delete this message');
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
    emoji: ReactionEmoji,
  ) {
    await this.ensureMember(conversationId, userId);
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message || message.conversationId !== conversationId) {
      throw new NotFoundException('Message not found');
    }

    const existing = await this.prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: { messageId, userId, emoji },
      },
    });
    if (existing) {
      await this.prisma.messageReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.messageReaction.create({
        data: { messageId, userId, emoji },
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
}
