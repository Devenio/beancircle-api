import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    private authService;
    constructor(config: ConfigService, authService: AuthService);
    validate(payload: {
        sub: string;
    }): Promise<{
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
    }>;
}
export {};
