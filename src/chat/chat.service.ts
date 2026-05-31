import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { MessageType, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

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

  async getMessages(conversationId: string, userId: string, cursor?: string, limit = 30) {
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
      },
    });
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    return { data: data.reverse(), nextCursor: hasMore ? data[0]?.id : null };
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    data: { type?: MessageType; body?: string; imageUrl?: string },
  ) {
    await this.ensureMember(conversationId, senderId);
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        type: data.type ?? MessageType.TEXT,
        body: data.body,
        imageUrl: data.imageUrl,
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
    this.realtime.emitToConversation(conversationId, 'message:new', message);
    return message;
  }

  async markRead(conversationId: string, userId: string) {
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  private async ensureMember(conversationId: string, userId: string) {
    const ok = await this.isMember(conversationId, userId);
    if (!ok) throw new NotFoundException('Conversation not found');
  }
}
