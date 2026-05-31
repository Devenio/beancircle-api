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
exports.RealtimeGateway = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const redis_service_1 = require("../redis/redis.service");
const chat_service_1 = require("../chat/chat.service");
let RealtimeGateway = class RealtimeGateway {
    jwt;
    redis;
    chatService;
    server;
    constructor(jwt, redis, chatService) {
        this.jwt = jwt;
        this.redis = redis;
        this.chatService = chatService;
    }
    async handleConnection(client) {
        try {
            const token = client.handshake.auth?.token ||
                (client.handshake.headers.authorization?.replace('Bearer ', '') ??
                    '');
            const payload = await this.jwt.verifyAsync(token);
            client.data.userId = payload.sub;
            await client.join(`user:${payload.sub}`);
            await this.redis.setOnline(payload.sub);
            this.server.emit('presence', { userId: payload.sub, online: true });
        }
        catch {
            client.disconnect();
        }
    }
    async handleDisconnect(client) {
        const userId = client.data.userId;
        if (userId) {
            await this.redis.setOffline(userId);
            this.server.emit('presence', { userId, online: false });
        }
    }
    emitToUser(userId, event, data) {
        this.server.to(`user:${userId}`).emit(event, data);
    }
    emitToConversation(conversationId, event, data) {
        this.server.to(`conversation:${conversationId}`).emit(event, data);
    }
    async joinConversation(client, conversationId) {
        const userId = client.data.userId;
        const member = await this.chatService.isMember(conversationId, userId);
        if (member)
            await client.join(`conversation:${conversationId}`);
    }
    handleTyping(client, data) {
        client
            .to(`conversation:${data.conversationId}`)
            .emit('typing', { userId: client.data.userId, typing: data.typing });
    }
    async handleRead(client, data) {
        const userId = client.data.userId;
        await this.chatService.markRead(data.conversationId, userId);
        this.emitToConversation(data.conversationId, 'message:read', {
            userId,
            conversationId: data.conversationId,
        });
    }
};
exports.RealtimeGateway = RealtimeGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], RealtimeGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('conversation:join'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "joinConversation", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('typing'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], RealtimeGateway.prototype, "handleTyping", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('message:read'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "handleRead", null);
exports.RealtimeGateway = RealtimeGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: { origin: '*' } }),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => chat_service_1.ChatService))),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        redis_service_1.RedisService,
        chat_service_1.ChatService])
], RealtimeGateway);
//# sourceMappingURL=realtime.gateway.js.map