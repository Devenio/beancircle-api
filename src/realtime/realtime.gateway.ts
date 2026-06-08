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

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
})
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
      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { lastSeenAt: new Date() },
      });
      this.server.emit('presence', { userId: payload.sub, online: true });
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = getSocketData(client).userId;
    if (userId) {
      await this.redis.setOffline(userId);
      const lastSeenAt = new Date();
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastSeenAt },
      });
      this.server.emit('presence', { userId, online: false, lastSeenAt: lastSeenAt.toISOString() });
    }
  }

  @SubscribeMessage('discover:scan:cancel')
  handleDiscoverScanCancel(@ConnectedSocket() client: Socket) {
    const userId = getSocketData(client).userId;
    if (!userId) return;
    this.server.to(`user:${userId}`).emit('discover:scan:cancelled', { userId });
  }

  @SubscribeMessage('presence:heartbeat')
  async handlePresenceHeartbeat(@ConnectedSocket() client: Socket) {
    const userId = getSocketData(client).userId;
    if (!userId) return;
    await this.redis.refreshOnline(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });
  }

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToConversation(conversationId: string, event: string, data: unknown) {
    this.server.to(`conversation:${conversationId}`).emit(event, data);
  }

  emitToSquad(squadId: string, event: string, data: unknown) {
    this.server.to(`squad:${squadId}`).emit(event, data);
  }

  @SubscribeMessage('squad:join')
  async joinSquad(
    @ConnectedSocket() client: Socket,
    @MessageBody() squadId: string,
  ) {
    const userId = getSocketData(client).userId;
    if (!userId || !squadId) return;
    const member = await this.prisma.squadMember.findUnique({
      where: { squadId_userId: { squadId, userId } },
      select: { id: true },
    });
    if (member) await client.join(`squad:${squadId}`);
  }

  @SubscribeMessage('squad:leave')
  async leaveSquad(
    @ConnectedSocket() client: Socket,
    @MessageBody() squadId: string,
  ) {
    await client.leave(`squad:${squadId}`);
  }

  @SubscribeMessage('squad:typing')
  squadTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { squadId: string; typing?: boolean },
  ) {
    const socketData = getSocketData(client);
    if (!socketData.userId || !data.squadId) return;
    client.to(`squad:${data.squadId}`).emit('squad:typing', {
      userId: socketData.userId,
      username: socketData.username,
      squadId: data.squadId,
      typing: data.typing ?? true,
    });
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
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; typing: boolean },
  ) {
    const socketData = getSocketData(client);
    const userId = socketData.userId;
    if (!userId || !data.conversationId) return;
    const member = await this.chatService.isMember(data.conversationId, userId);
    if (!member) return;
    const payload = {
      userId,
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
    @MessageBody()
    data: { conversationId: string; lastMessageId?: string },
  ) {
    const userId = getSocketData(client).userId;
    if (!userId || !data?.conversationId) return;
    const result = await this.chatService.markRead(
      data.conversationId,
      userId,
      data.lastMessageId,
    );
    // Tell the peer their messages were read (for seen receipts)...
    this.emitToConversation(data.conversationId, 'message:read', {
      userId,
      conversationId: data.conversationId,
      lastReadMessageId: result.lastReadMessageId,
      lastReadAt: result.lastReadAt,
    });
    // ...and tell the reader's own devices to clear unread for this thread.
    this.emitToUser(userId, 'conversation:read', {
      conversationId: data.conversationId,
      lastReadMessageId: result.lastReadMessageId,
    });
  }
}
