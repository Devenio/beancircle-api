import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
export declare class NotificationsService {
    private prisma;
    private realtime;
    constructor(prisma: PrismaService, realtime: RealtimeGateway);
    create(data: {
        userId: string;
        type: NotificationType;
        actorId?: string;
        entityType?: string;
        entityId?: string;
        payload?: object;
    }): Promise<{
        actor: {
            id: string;
            name: string | null;
            username: string | null;
            avatarUrl: string | null;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        userId: string;
        type: import("@prisma/client").$Enums.NotificationType;
        entityId: string | null;
        entityType: string | null;
        payload: import("@prisma/client/runtime/library").JsonValue | null;
        readAt: Date | null;
        actorId: string | null;
    }>;
    list(userId: string, cursor?: string, limit?: number): Promise<{
        data: ({
            actor: {
                id: string;
                name: string | null;
                username: string | null;
                avatarUrl: string | null;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            userId: string;
            type: import("@prisma/client").$Enums.NotificationType;
            entityId: string | null;
            entityType: string | null;
            payload: import("@prisma/client/runtime/library").JsonValue | null;
            readAt: Date | null;
            actorId: string | null;
        })[];
        nextCursor: string | null;
    }>;
    markRead(userId: string, id: string): Promise<import("@prisma/client").Prisma.BatchPayload>;
    markAllRead(userId: string): Promise<import("@prisma/client").Prisma.BatchPayload>;
}
