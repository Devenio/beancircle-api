import { PaginationDto } from '../common/dto/pagination.dto';
import { ChatService } from './chat.service';
declare class MessageAttachmentDto {
    url: string;
    name?: string;
    mimeType?: string;
    size?: number;
    durationSec?: number;
}
declare class MessageLocationDto {
    lat: number;
    lng: number;
    label?: string;
}
declare class SendMessageDto {
    type?: string;
    body?: string;
    imageUrl?: string;
    attachment?: MessageAttachmentDto;
    location?: MessageLocationDto;
    sticker?: string;
    replyToId?: string;
    replyToSnippet?: string;
}
declare class CreateConversationDto {
    participantId: string;
}
declare class EditMessageDto {
    body: string;
}
declare class PinMessageDto {
    pinned?: boolean;
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
    send(user: {
        id: string;
    }, id: string, dto: SendMessageDto): Promise<{
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
    edit(user: {
        id: string;
    }, id: string, messageId: string, dto: EditMessageDto): Promise<{
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
    delete(user: {
        id: string;
    }, id: string, messageId: string): Promise<{
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
    seen(user: {
        id: string;
    }, id: string, messageId: string): Promise<{
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
    pin(user: {
        id: string;
    }, id: string, messageId: string, dto: PinMessageDto): Promise<{
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
}
export {};
