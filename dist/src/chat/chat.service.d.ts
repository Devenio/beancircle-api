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
        data: {
            id: string;
            senderId: string;
            sender: {
                id: string;
                username: string | null;
                name?: string | null;
                avatarUrl?: string | null;
            };
            type: string;
            body: string | null;
            imageUrl: string | null;
            attachment: {
                url: string;
                name: string | undefined;
                mimeType: string | undefined;
                size: number | undefined;
                durationSec: number | undefined;
            } | undefined;
            location: {
                lat: number;
                lng: number;
                label: string | undefined;
            } | undefined;
            sticker: string | undefined;
            replyToId: string | undefined;
            replyToSnippet: string | undefined;
            editedAt: Date | undefined;
            deletedAt: Date | undefined;
            pinned: boolean;
            seenBy: string[];
            createdAt: Date;
        }[];
        nextCursor: string | null;
    }>;
    private parseType;
    private serializeMessage;
    sendMessage(conversationId: string, senderId: string, data: SendMessageInput): Promise<{
        id: string;
        senderId: string;
        sender: {
            id: string;
            username: string | null;
            name?: string | null;
            avatarUrl?: string | null;
        };
        type: string;
        body: string | null;
        imageUrl: string | null;
        attachment: {
            url: string;
            name: string | undefined;
            mimeType: string | undefined;
            size: number | undefined;
            durationSec: number | undefined;
        } | undefined;
        location: {
            lat: number;
            lng: number;
            label: string | undefined;
        } | undefined;
        sticker: string | undefined;
        replyToId: string | undefined;
        replyToSnippet: string | undefined;
        editedAt: Date | undefined;
        deletedAt: Date | undefined;
        pinned: boolean;
        seenBy: string[];
        createdAt: Date;
    }>;
    markRead(conversationId: string, userId: string): Promise<void>;
    editMessage(conversationId: string, messageId: string, userId: string, body: string): Promise<{
        id: string;
        senderId: string;
        sender: {
            id: string;
            username: string | null;
            name?: string | null;
            avatarUrl?: string | null;
        };
        type: string;
        body: string | null;
        imageUrl: string | null;
        attachment: {
            url: string;
            name: string | undefined;
            mimeType: string | undefined;
            size: number | undefined;
            durationSec: number | undefined;
        } | undefined;
        location: {
            lat: number;
            lng: number;
            label: string | undefined;
        } | undefined;
        sticker: string | undefined;
        replyToId: string | undefined;
        replyToSnippet: string | undefined;
        editedAt: Date | undefined;
        deletedAt: Date | undefined;
        pinned: boolean;
        seenBy: string[];
        createdAt: Date;
    }>;
    deleteMessage(conversationId: string, messageId: string, userId: string): Promise<{
        id: string;
        senderId: string;
        sender: {
            id: string;
            username: string | null;
            name?: string | null;
            avatarUrl?: string | null;
        };
        type: string;
        body: string | null;
        imageUrl: string | null;
        attachment: {
            url: string;
            name: string | undefined;
            mimeType: string | undefined;
            size: number | undefined;
            durationSec: number | undefined;
        } | undefined;
        location: {
            lat: number;
            lng: number;
            label: string | undefined;
        } | undefined;
        sticker: string | undefined;
        replyToId: string | undefined;
        replyToSnippet: string | undefined;
        editedAt: Date | undefined;
        deletedAt: Date | undefined;
        pinned: boolean;
        seenBy: string[];
        createdAt: Date;
    }>;
    setMessagePinned(conversationId: string, messageId: string, userId: string, pinned?: boolean): Promise<{
        id: string;
        senderId: string;
        sender: {
            id: string;
            username: string | null;
            name?: string | null;
            avatarUrl?: string | null;
        };
        type: string;
        body: string | null;
        imageUrl: string | null;
        attachment: {
            url: string;
            name: string | undefined;
            mimeType: string | undefined;
            size: number | undefined;
            durationSec: number | undefined;
        } | undefined;
        location: {
            lat: number;
            lng: number;
            label: string | undefined;
        } | undefined;
        sticker: string | undefined;
        replyToId: string | undefined;
        replyToSnippet: string | undefined;
        editedAt: Date | undefined;
        deletedAt: Date | undefined;
        pinned: boolean;
        seenBy: string[];
        createdAt: Date;
    }>;
    markMessageSeen(conversationId: string, messageId: string, userId: string): Promise<{
        seen: boolean;
        message: {
            id: string;
            senderId: string;
            sender: {
                id: string;
                username: string | null;
                name?: string | null;
                avatarUrl?: string | null;
            };
            type: string;
            body: string | null;
            imageUrl: string | null;
            attachment: {
                url: string;
                name: string | undefined;
                mimeType: string | undefined;
                size: number | undefined;
                durationSec: number | undefined;
            } | undefined;
            location: {
                lat: number;
                lng: number;
                label: string | undefined;
            } | undefined;
            sticker: string | undefined;
            replyToId: string | undefined;
            replyToSnippet: string | undefined;
            editedAt: Date | undefined;
            deletedAt: Date | undefined;
            pinned: boolean;
            seenBy: string[];
            createdAt: Date;
        };
    }>;
    private ensureMember;
}
export {};
