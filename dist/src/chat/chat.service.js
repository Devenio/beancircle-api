"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const notifications_service_1 = require("../notifications/notifications.service");
const realtime_gateway_1 = require("../realtime/realtime.gateway");
let ChatService = class ChatService {
    prisma;
    notifications;
    realtime;
    constructor(prisma, notifications, realtime) {
        this.prisma = prisma;
        this.notifications = notifications;
        this.realtime = realtime;
    }
    async isMember(conversationId, userId) {
        const m = await this.prisma.conversationMember.findUnique({
            where: {
                conversationId_userId: { conversationId, userId },
            },
        });
        return !!m;
    }
    async listConversations(userId) {
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
    async findOrCreate(userId, participantId) {
        if (userId === participantId) {
            throw new common_1.BadRequestException('Cannot message yourself');
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
        if (existing && existing.members.length === 2)
            return existing;
        return this.prisma.conversation.create({
            data: {
                members: {
                    create: [{ userId }, { userId: participantId }],
                },
            },
            include: { members: true },
        });
    }
    async getMessages(conversationId, userId, cursor, limit = 30) {
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
        return {
            data: data.reverse().map((item) => this.serializeMessage(item)),
            nextCursor: hasMore ? data[0]?.id : null,
        };
    }
    parseType(type) {
        if (!type)
            return client_1.MessageType.TEXT;
        const normalized = type.toUpperCase();
        if (normalized in client_1.MessageType) {
            return normalized;
        }
        throw new common_1.BadRequestException('Invalid message type');
    }
    serializeMessage(message) {
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
            location: message.locationLat != null && message.locationLng != null
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
            createdAt: message.createdAt,
        };
    }
    async sendMessage(conversationId, senderId, data) {
        await this.ensureMember(conversationId, senderId);
        const messageType = this.parseType(data.type);
        const body = data.body?.trim();
        const hasText = Boolean(body);
        const hasAttachment = Boolean(data.imageUrl || data.attachment?.url);
        const hasLocation = Boolean(data.location);
        const hasSticker = Boolean(data.sticker);
        if (!hasText && !hasAttachment && !hasLocation && !hasSticker) {
            throw new common_1.BadRequestException('Message content is required');
        }
        const message = await this.prisma.message.create({
            data: {
                conversationId,
                senderId,
                type: messageType,
                body,
                imageUrl: data.imageUrl ??
                    (messageType === client_1.MessageType.IMAGE
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
                type: client_1.NotificationType.NEW_MESSAGE,
                actorId: senderId,
                entityType: 'conversation',
                entityId: conversationId,
            });
        }
        const payload = this.serializeMessage(message);
        this.realtime.emitToConversation(conversationId, 'message:new', payload);
        return payload;
    }
    async markRead(conversationId, userId) {
        await this.prisma.conversationMember.update({
            where: { conversationId_userId: { conversationId, userId } },
            data: { lastReadAt: new Date() },
        });
    }
    async editMessage(conversationId, messageId, userId, body) {
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
            throw new common_1.NotFoundException('Message not found');
        }
        if (existing.senderId !== userId) {
            throw new common_1.ForbiddenException('Cannot edit this message');
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
    async deleteMessage(conversationId, messageId, userId) {
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
            throw new common_1.NotFoundException('Message not found');
        }
        if (existing.senderId !== userId) {
            throw new common_1.ForbiddenException('Cannot delete this message');
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
        this.realtime.emitToConversation(conversationId, 'message:deleted', payload);
        return payload;
    }
    async setMessagePinned(conversationId, messageId, userId, pinned) {
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
            throw new common_1.NotFoundException('Message not found');
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
    async markMessageSeen(conversationId, messageId, userId) {
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
            throw new common_1.NotFoundException('Message not found');
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
    async ensureMember(conversationId, userId) {
        const ok = await this.isMember(conversationId, userId);
        if (!ok)
            throw new common_1.NotFoundException('Conversation not found');
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => notifications_service_1.NotificationsService))),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => realtime_gateway_1.RealtimeGateway))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_service_1.NotificationsService,
        realtime_gateway_1.RealtimeGateway])
], ChatService);
//# sourceMappingURL=chat.service.js.map