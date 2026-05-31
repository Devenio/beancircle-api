import { MessageType } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ChatService } from './chat.service';
declare class SendMessageDto {
    type?: MessageType;
    body?: string;
    imageUrl?: string;
}
declare class CreateConversationDto {
    participantId: string;
}
export declare class ChatController {
    private chatService;
    constructor(chatService: ChatService);
    list(user: {
        id: string;
    }): Promise<{
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
    create(user: {
        id: string;
    }, dto: CreateConversationDto): Promise<{
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
    messages(user: {
        id: string;
    }, id: string, q: PaginationDto): Promise<{
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
    send(user: {
        id: string;
    }, id: string, dto: SendMessageDto): Promise<{
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
}
export {};
