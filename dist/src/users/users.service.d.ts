import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
export declare class UsersService {
    private prisma;
    private notifications;
    constructor(prisma: PrismaService, notifications: NotificationsService);
    getMe(userId: string): import("@prisma/client").Prisma.Prisma__UserClient<{
        id: string;
        name: string | null;
        countryId: string | null;
        city: {
            id: string;
            name: string;
            countryId: string;
            slug: string;
        } | null;
        phone: string | null;
        email: string | null;
        username: string | null;
        bio: string | null;
        avatarUrl: string | null;
        cityId: string | null;
        role: import("@prisma/client").$Enums.UserRole;
        postsCount: number;
        followersCount: number;
        followingCount: number;
        createdAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    updateMe(userId: string, dto: UpdateProfileDto): Promise<{
        id: string;
        name: string | null;
        countryId: string | null;
        city: {
            id: string;
            name: string;
            countryId: string;
            slug: string;
        } | null;
        username: string | null;
        bio: string | null;
        avatarUrl: string | null;
        cityId: string | null;
        role: import("@prisma/client").$Enums.UserRole;
        postsCount: number;
        followersCount: number;
        followingCount: number;
        createdAt: Date;
    }>;
    getByUsername(username: string, viewerId?: string): Promise<{
        isFollowing: boolean;
        isSelf: boolean;
        id: string;
        name: string | null;
        countryId: string | null;
        favoriteCafes: ({
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
            cityId: string;
            userId: string;
            cafeId: string;
        })[];
        city: {
            id: string;
            name: string;
            countryId: string;
            slug: string;
        } | null;
        username: string | null;
        bio: string | null;
        avatarUrl: string | null;
        cityId: string | null;
        role: import("@prisma/client").$Enums.UserRole;
        postsCount: number;
        followersCount: number;
        followingCount: number;
        createdAt: Date;
    }>;
    follow(followerId: string, followingId: string): Promise<{
        following: boolean;
    }>;
    unfollow(followerId: string, followingId: string): Promise<{
        following: boolean;
    }>;
    getFavoriteCafes(userId: string): Promise<({
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
        cityId: string;
        userId: string;
        cafeId: string;
    })[]>;
    addFavoriteCafe(userId: string, cafeId: string): Promise<{
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
        cityId: string;
        userId: string;
        cafeId: string;
    }>;
    removeFavoriteCafe(userId: string, cafeId: string): Promise<{
        removed: boolean;
    }>;
    listCities(): import("@prisma/client").Prisma.PrismaPromise<({
        country: {
            id: string;
            code: string;
            name: string;
        };
    } & {
        id: string;
        name: string;
        countryId: string;
        slug: string;
    })[]>;
}
