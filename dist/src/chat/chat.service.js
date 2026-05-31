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
        return { data: data.reverse(), nextCursor: hasMore ? data[0]?.id : null };
    }
    async sendMessage(conversationId, senderId, data) {
        await this.ensureMember(conversationId, senderId);
        const message = await this.prisma.message.create({
            data: {
                conversationId,
                senderId,
                type: data.type ?? client_1.MessageType.TEXT,
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
                type: client_1.NotificationType.NEW_MESSAGE,
                actorId: senderId,
                entityType: 'conversation',
                entityId: conversationId,
            });
        }
        this.realtime.emitToConversation(conversationId, 'message:new', message);
        return message;
    }
    async markRead(conversationId, userId) {
        await this.prisma.conversationMember.update({
            where: { conversationId_userId: { conversationId, userId } },
            data: { lastReadAt: new Date() },
        });
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