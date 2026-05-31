import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { OtpRequestDto } from './dto/otp-request.dto';
import { OtpVerifyDto } from './dto/otp-verify.dto';
export declare class AuthController {
    private authService;
    private config;
    constructor(authService: AuthService, config: ConfigService);
    requestOtp(dto: OtpRequestDto): Promise<{
        message: string;
        code: string;
    } | {
        message: string;
        code?: undefined;
    }>;
    verifyOtp(dto: OtpVerifyDto): Promise<{
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
    googleAuth(): void;
    googleCallback(req: {
        user: object;
    }, res: Response): Promise<void>;
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
    logout(user: {
        id: string;
    }): Promise<{
        message: string;
    }>;
}
