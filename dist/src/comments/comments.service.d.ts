import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
export declare class CommentsService {
    private prisma;
    private notifications;
    constructor(prisma: PrismaService, notifications: NotificationsService);
    createOnPost(authorId: string, postId: string, body: string): Promise<{
        author: {
            id: string;
            name: string | null;
            username: string | null;
            avatarUrl: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        authorId: string;
        postId: string | null;
        reviewId: string | null;
        body: string;
    }>;
    createOnReview(authorId: string, reviewId: string, body: string): Promise<{
        author: {
            id: string;
            name: string | null;
            username: string | null;
            avatarUrl: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        authorId: string;
        postId: string | null;
        reviewId: string | null;
        body: string;
    }>;
    listForPost(postId: string): import("@prisma/client").Prisma.PrismaPromise<({
        author: {
            id: string;
            name: string | null;
            username: string | null;
            avatarUrl: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        authorId: string;
        postId: string | null;
        reviewId: string | null;
        body: string;
    })[]>;
    listForReview(reviewId: string): import("@prisma/client").Prisma.PrismaPromise<({
        author: {
            id: string;
            name: string | null;
            username: string | null;
            avatarUrl: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        authorId: string;
        postId: string | null;
        reviewId: string | null;
        body: string;
    })[]>;
}
