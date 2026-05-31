import { MessageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
export declare class ChatService {
    private prisma;
    private notifications;
    private realtime;
    constructor(prisma: PrismaService, notifications: NotificationsService, realtime: RealtimeGateway);
    isMember(conversationId: string, userId: string): Promise<boolean>;
    listConversations(userId: string): Promise<{
        otherMember: {
            id: string;
            name: string | null;
            username: string | null;
            avatarUrl: string | null;
        } | undefined;
        lastMessage: {
            id: string;
            createdAt: Date;
            type: import("@prisma/client").$Enums.MessageType;
            body: string | null;
            conversationId: string;
            senderId: string;
            imageUrl: string | null;
        };
        members: ({
            user: {
                id: string;
                name: string | null;
                username: string | null;
                avatarUrl: string | null;
            };
        } & {
            id: string;
            userId: string;
            lastReadAt: Date | null;
            conversationId: string;
        })[];
        messages: {
            id: string;
            createdAt: Date;
            type: import("@prisma/client").$Enums.MessageType;
            body: string | null;
            conversationId: string;
            senderId: string;
            imageUrl: string | null;
        }[];
        id: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    findOrCreate(userId: string, participantId: string): Promise<{
        members: {
            id: string;
            userId: string;
            lastReadAt: Date | null;
            conversationId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getMessages(conversationId: string, userId: string, cursor?: string, limit?: number): Promise<{
        data: ({
            sender: {
                id: string;
                name: string | null;
                username: string | null;
                avatarUrl: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            type: import("@prisma/client").$Enums.MessageType;
            body: string | null;
            conversationId: string;
            senderId: string;
            imageUrl: string | null;
        })[];
        nextCursor: string | null;
    }>;
    sendMessage(conversationId: string, senderId: string, data: {
        type?: MessageType;
        body?: string;
        imageUrl?: string;
    }): Promise<{
        sender: {
            id: string;
            name: string | null;
            username: string | null;
            avatarUrl: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.MessageType;
        body: string | null;
        conversationId: string;
        senderId: string;
        imageUrl: string | null;
    }>;
    markRead(conversationId: string, userId: string): Promise<void>;
    private ensureMember;
}
