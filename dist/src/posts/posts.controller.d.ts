import { PostType } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PostsService } from './posts.service';
declare class CreatePostDto {
    type: PostType;
    caption?: string;
    cafeId?: string;
    photoUrls?: string[];
}
export declare class PostsController {
    private postsService;
    constructor(postsService: PostsService);
    feed(user: {
        id: string;
    }, q: PaginationDto): Promise<{
        data: ({
            likes: {
                id: string;
                userId: string;
                postId: string | null;
                reviewId: string | null;
            }[];
            cafe: {
                id: string;
                name: string;
                countryId: string;
                cityId: string;
                createdAt: Date;
                updatedAt: Date;
                address: string;
                lat: number;
                lng: number;
                avgRating: number;
                followerCount: number;
                reviewCount: number;
                isPartner: boolean;
            } | null;
            photos: {
                id: string;
                url: string;
                order: number;
                postId: string;
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
            checkin: ({
                cafe: {
                    id: string;
                    name: string;
                    countryId: string;
                    cityId: string;
                    createdAt: Date;
                    updatedAt: Date;
                    address: string;
                    lat: number;
                    lng: number;
                    avgRating: number;
                    followerCount: number;
                    reviewCount: number;
                    isPartner: boolean;
                };
            } & {
                id: string;
                countryId: string;
                cityId: string;
                createdAt: Date;
                userId: string;
                cafeId: string;
            }) | null;
            savedBy: {
                id: string;
                userId: string;
                postId: string;
            }[];
        } & {
            id: string;
            countryId: string;
            cityId: string;
            createdAt: Date;
            updatedAt: Date;
            cafeId: string | null;
            type: import("@prisma/client").$Enums.PostType;
            caption: string | null;
            authorId: string;
            checkinId: string | null;
        } & {
            liked: boolean;
            saved: boolean;
        })[];
        nextCursor: string | null;
    }>;
    get(id: string, user?: {
        id: string;
    }): Promise<{
        likes: {
            id: string;
            userId: string;
            postId: string | null;
            reviewId: string | null;
        }[];
        cafe: {
            id: string;
            name: string;
            countryId: string;
            cityId: string;
            createdAt: Date;
            updatedAt: Date;
            address: string;
            lat: number;
            lng: number;
            avgRating: number;
            followerCount: number;
            reviewCount: number;
            isPartner: boolean;
        } | null;
        photos: {
            id: string;
            url: string;
            order: number;
            postId: string;
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
        checkin: ({
            cafe: {
                id: string;
                name: string;
                countryId: string;
                cityId: string;
                createdAt: Date;
                updatedAt: Date;
                address: string;
                lat: number;
                lng: number;
                avgRating: number;
                followerCount: number;
                reviewCount: number;
                isPartner: boolean;
            };
        } & {
            id: string;
            countryId: string;
            cityId: string;
            createdAt: Date;
            userId: string;
            cafeId: string;
        }) | null;
        savedBy: {
            id: string;
            userId: string;
            postId: string;
        }[];
    } & {
        id: string;
        countryId: string;
        cityId: string;
        createdAt: Date;
        updatedAt: Date;
        cafeId: string | null;
        type: import("@prisma/client").$Enums.PostType;
        caption: string | null;
        authorId: string;
        checkinId: string | null;
    }>;
    create(user: {
        id: string;
    }, dto: CreatePostDto): Promise<{
        cafe: {
            id: string;
            name: string;
            countryId: string;
            cityId: string;
            createdAt: Date;
            updatedAt: Date;
            address: string;
            lat: number;
            lng: number;
            avgRating: number;
            followerCount: number;
            reviewCount: number;
            isPartner: boolean;
        } | null;
        photos: {
            id: string;
            url: string;
            order: number;
            postId: string;
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
        cafeId: string | null;
        type: import("@prisma/client").$Enums.PostType;
        caption: string | null;
        authorId: string;
        checkinId: string | null;
    }>;
    save(user: {
        id: string;
    }, id: string): Promise<{
        saved: boolean;
    }>;
    unsave(user: {
        id: string;
    }, id: string): Promise<{
        saved: boolean;
    }>;
}
export {};
