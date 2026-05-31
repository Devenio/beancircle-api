import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';
export declare class UsersController {
    private usersService;
    constructor(usersService: UsersService);
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
    getMe(user: {
        id: string;
    }): import("@prisma/client").Prisma.Prisma__UserClient<{
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
    updateMe(user: {
        id: string;
    }, dto: UpdateProfileDto): Promise<{
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
    favoriteCafes(user: {
        id: string;
    }): Promise<({
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
    addFavorite(user: {
        id: string;
    }, cafeId: string): Promise<{
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
    removeFavorite(user: {
        id: string;
    }, cafeId: string): Promise<{
        removed: boolean;
    }>;
    getProfile(username: string, user?: {
        id: string;
    }): Promise<{
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
}
