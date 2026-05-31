import { PostType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
export declare class PostsService {
    private prisma;
    private notifications;
    constructor(prisma: PrismaService, notifications: NotificationsService);
    create(authorId: string, data: {
        type: PostType;
        caption?: string;
        cafeId?: string;
        photoUrls?: string[];
    }): Promise<{
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
    getFeed(userId: string, cursor?: string, limit?: number): Promise<{
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
    getById(id: string, userId?: string): Promise<{
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
    getByUsername(username: string, cursor?: string, limit?: number): Promise<{
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
    save(userId: string, postId: string): Promise<{
        saved: boolean;
    }>;
    unsave(userId: string, postId: string): Promise<{
        saved: boolean;
    }>;
    private postInclude;
    private paginate;
}
