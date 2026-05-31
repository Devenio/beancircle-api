import { CafesService } from './cafes.service';
import { CheckinsService } from '../checkins/checkins.service';
export declare class CafesController {
    private cafesService;
    private checkinsService;
    constructor(cafesService: CafesService, checkinsService: CheckinsService);
    list(cityId?: string, q?: string): import("@prisma/client").Prisma.PrismaPromise<({
        city: {
            id: string;
            name: string;
            countryId: string;
            slug: string;
        };
        photos: {
            id: string;
            url: string;
            kind: import("@prisma/client").$Enums.CafePhotoKind;
            order: number;
            cafeId: string;
        }[];
    } & {
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
    })[]>;
    get(id: string, user?: {
        id: string;
    }): Promise<{
        isFollowing: boolean;
        reviews: ({
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
        })[];
        city: {
            id: string;
            name: string;
            countryId: string;
            slug: string;
        };
        photos: {
            id: string;
            url: string;
            kind: import("@prisma/client").$Enums.CafePhotoKind;
            order: number;
            cafeId: string;
        }[];
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
    }>;
    follow(user: {
        id: string;
    }, id: string): Promise<{
        following: boolean;
    }>;
    unfollow(user: {
        id: string;
    }, id: string): Promise<{
        following: boolean;
    }>;
    checkin(user: {
        id: string;
    }, id: string): Promise<{
        user: {
            id: string;
            name: string | null;
            username: string | null;
            avatarUrl: string | null;
        };
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
    }>;
    create(body: Record<string, unknown>): import("@prisma/client").Prisma.Prisma__CafeClient<{
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    update(id: string, body: Record<string, unknown>): import("@prisma/client").Prisma.Prisma__CafeClient<{
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
}
