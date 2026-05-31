import { CheckinsService } from './checkins.service';
export declare class CheckinsController {
    private checkinsService;
    constructor(checkinsService: CheckinsService);
    create(user: {
        id: string;
    }, cafeId: string): Promise<{
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
    list(user?: {
        id: string;
    }): import("@prisma/client").Prisma.PrismaPromise<({
        user: {
            id: string;
            name: string | null;
            username: string | null;
            avatarUrl: string | null;
        };
        cafe: {
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
        };
    } & {
        id: string;
        countryId: string;
        cityId: string;
        createdAt: Date;
        userId: string;
        cafeId: string;
    })[]>;
}
