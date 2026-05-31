import { PaginationDto } from '../common/dto/pagination.dto';
import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private notificationsService;
    constructor(notificationsService: NotificationsService);
    list(user: {
        id: string;
    }, query: PaginationDto): Promise<{
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
    markRead(user: {
        id: string;
    }, id: string): Promise<import("@prisma/client").Prisma.BatchPayload>;
    markAllRead(user: {
        id: string;
    }): Promise<import("@prisma/client").Prisma.BatchPayload>;
}
