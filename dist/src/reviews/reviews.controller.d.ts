import { ReviewsService } from './reviews.service';
declare class CreateReviewDto {
    rating: number;
    body?: string;
    photoUrls?: string[];
}
export declare class ReviewsController {
    private reviewsService;
    constructor(reviewsService: ReviewsService);
    create(user: {
        id: string;
    }, cafeId: string, dto: CreateReviewDto): Promise<{
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
    list(cafeId: string): import("@prisma/client").Prisma.PrismaPromise<({
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
export {};
