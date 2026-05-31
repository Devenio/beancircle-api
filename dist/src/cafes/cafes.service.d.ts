import { PrismaService } from '../prisma/prisma.service';
export declare class CafesService {
    private prisma;
    constructor(prisma: PrismaService);
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
    get(id: string, userId?: string): Promise<{
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
    follow(userId: string, cafeId: string): Promise<{
        following: boolean;
    }>;
    unfollow(userId: string, cafeId: string): Promise<{
        following: boolean;
    }>;
    create(data: {
        name: string;
        address: string;
        lat: number;
        lng: number;
        cityId: string;
        countryId: string;
        isPartner?: boolean;
    }): import("@prisma/client").Prisma.Prisma__CafeClient<{
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
    update(id: string, data: Partial<{
        name: string;
        address: string;
        isPartner: boolean;
    }>): import("@prisma/client").Prisma.Prisma__CafeClient<{
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
