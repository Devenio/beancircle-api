import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
export declare class LikesService {
    private prisma;
    private notifications;
    constructor(prisma: PrismaService, notifications: NotificationsService);
    togglePost(userId: string, postId: string): Promise<{
        liked: boolean;
    }>;
    toggleReview(userId: string, reviewId: string): Promise<{
        liked: boolean;
    }>;
}
