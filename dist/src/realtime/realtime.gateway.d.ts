import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';
import { ChatService } from '../chat/chat.service';
export declare class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private jwt;
    private redis;
    private chatService;
    server: Server;
    constructor(jwt: JwtService, redis: RedisService, chatService: ChatService);
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    emitToUser(userId: string, event: string, data: unknown): void;
    emitToConversation(conversationId: string, event: string, data: unknown): void;
    joinConversation(client: Socket, conversationId: string): Promise<void>;
    handleTyping(client: Socket, data: {
        conversationId: string;
        typing: boolean;
    }): void;
    handleRead(client: Socket, data: {
        conversationId: string;
    }): Promise<void>;
}
