import { PrismaService } from '../prisma/prisma.service';
export declare class ReviewsService {
    private prisma;
    constructor(prisma: PrismaService);
    create(authorId: string, cafeId: string, data: {
        rating: number;
        body?: string;
        photoUrls?: string[];
    }): Promise<{
        photos: {
            id: string;
            url: string;
            reviewId: string;
        }[];
        author: {
            id: string;
            name: string | null;
            username: string | null;
            avatarUrl: string | null;
        };
    } & {
        id: string;
        countryId: string;
        cityId: string;
        createdAt: Date;
        updatedAt: Date;
        cafeId: string;
        authorId: string;
        body: string | null;
        rating: number;
    }>;
    listByCafe(cafeId: string): import("@prisma/client").Prisma.PrismaPromise<({
        photos: {
            id: string;
            url: string;
            reviewId: string;
        }[];
        _count: {
            comments: number;
            likes: number;
        };
        author: {
            id: string;
            name: string | null;
            username: string | null;
            avatarUrl: string | null;
        };
    } & {
        id: string;
        countryId: string;
        cityId: string;
        createdAt: Date;
        updatedAt: Date;
        cafeId: string;
        authorId: string;
        body: string | null;
        rating: number;
    })[]>;
}
