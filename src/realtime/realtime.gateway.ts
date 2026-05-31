import { Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';
import { ChatService } from '../chat/chat.service';
import { PrismaService } from '../prisma/prisma.service';

type SocketAuthData = {
  userId?: string;
  username?: string | null;
};

function getSocketData(client: Socket): SocketAuthData {
  return client.data as SocketAuthData;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private jwt: JwtService,
    private redis: RedisService,
    private prisma: PrismaService,
    @Inject(forwardRef(() => ChatService))
    private chatService: ChatService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers.authorization?.replace('Bearer ', '') ?? '');
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      const socketData = getSocketData(client);
      socketData.userId = payload.sub;
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { username: true },
      });
      socketData.username = user?.username ?? null;
      await client.join(`user:${payload.sub}`);
      await this.redis.setOnline(payload.sub);
      this.server.emit('presence', { userId: payload.sub, online: true });
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = getSocketData(client).userId;
    if (userId) {
      await this.redis.setOffline(userId);
      this.server.emit('presence', { userId, online: false });
    }
  }

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToConversation(conversationId: string, event: string, data: unknown) {
    this.server.to(`conversation:${conversationId}`).emit(event, data);
  }

  @SubscribeMessage('conversation:join')
  async joinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    const userId = getSocketData(client).userId;
    if (!userId) return;
    const member = await this.chatService.isMember(conversationId, userId);
    if (member) await client.join(`conversation:${conversationId}`);
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; typing: boolean },
  ) {
    const socketData = getSocketData(client);
    const payload = {
      userId: socketData.userId,
      username: socketData.username,
      typing: data.typing,
      conversationId: data.conversationId,
    };
    client.to(`conversation:${data.conversationId}`).emit('typing', payload);
    client
      .to(`conversation:${data.conversationId}`)
      .emit('conversation:typing', payload);
  }

  @SubscribeMessage('conversation:typing')
  handleConversationTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; typing?: boolean },
  ) {
    this.handleTyping(client, {
      conversationId: data.conversationId,
      typing: data.typing ?? true,
    });
  }

  @SubscribeMessage('conversation:leave')
  async leaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    await client.leave(`conversation:${conversationId}`);
  }

  @SubscribeMessage('message:read')
  async handleRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = getSocketData(client).userId;
    if (!userId) return;
    await this.chatService.markRead(data.conversationId, userId);
    this.emitToConversation(data.conversationId, 'message:read', {
      userId,
      conversationId: data.conversationId,
    });
  }
}
