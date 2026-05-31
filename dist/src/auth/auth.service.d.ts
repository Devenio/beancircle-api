import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
export declare class AuthService {
    private prisma;
    private redis;
    private jwt;
    private config;
    constructor(prisma: PrismaService, redis: RedisService, jwt: JwtService, config: ConfigService);
    requestOtp(phone: string): Promise<{
        message: string;
        code: string;
    } | {
        message: string;
        code?: undefined;
    }>;
    verifyOtp(phone: string, code: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            phone: string | null;
            email: string | null;
            username: string | null;
            name: string | null;
            bio: string | null;
            avatarUrl: string | null;
            cityId: string | null;
            countryId: string | null;
            role: import("@prisma/client").$Enums.UserRole;
            city: {
                id: string;
                name: string;
                countryId: string;
                slug: string;
            } | null;
            needsOnboarding: boolean;
        };
    }>;
    validateGoogleUser(profile: {
        googleId: string;
        email?: string;
        name?: string;
        avatarUrl?: string;
    }): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            phone: string | null;
            email: string | null;
            username: string | null;
            name: string | null;
            bio: string | null;
            avatarUrl: string | null;
            cityId: string | null;
            countryId: string | null;
            role: import("@prisma/client").$Enums.UserRole;
            city: {
                id: string;
                name: string;
                countryId: string;
                slug: string;
            } | null;
            needsOnboarding: boolean;
        };
    }>;
    refresh(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            phone: string | null;
            email: string | null;
            username: string | null;
            name: string | null;
            bio: string | null;
            avatarUrl: string | null;
            cityId: string | null;
            countryId: string | null;
            role: import("@prisma/client").$Enums.UserRole;
            city: {
                id: string;
                name: string;
                countryId: string;
                slug: string;
            } | null;
            needsOnboarding: boolean;
        };
    }>;
    logout(userId: string): Promise<{
        message: string;
    }>;
    private issueTokens;
    validateUser(userId: string): Promise<{
        id: string;
        name: string | null;
        countryId: string | null;
        phone: string | null;
        email: string | null;
        googleId: string | null;
        username: string | null;
        bio: string | null;
        avatarUrl: string | null;
        cityId: string | null;
        role: import("@prisma/client").$Enums.UserRole;
        postsCount: number;
        followersCount: number;
        followingCount: number;
        refreshTokenHash: string | null;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
}
