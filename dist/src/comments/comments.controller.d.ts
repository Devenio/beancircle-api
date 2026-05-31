import { CommentsService } from './comments.service';
declare class CommentBodyDto {
    body: string;
}
export declare class CommentsController {
    private commentsService;
    constructor(commentsService: CommentsService);
    listPost(postId: string): import("@prisma/client").Prisma.PrismaPromise<({
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
    createPost(user: {
        id: string;
    }, postId: string, dto: CommentBodyDto): Promise<{
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
    listReview(reviewId: string): import("@prisma/client").Prisma.PrismaPromise<({
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
    createReview(user: {
        id: string;
    }, reviewId: string, dto: CommentBodyDto): Promise<{
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
}
export {};
