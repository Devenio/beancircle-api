"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
let AuthService = class AuthService {
    prisma;
    redis;
    jwt;
    config;
    constructor(prisma, redis, jwt, config) {
        this.prisma = prisma;
        this.redis = redis;
        this.jwt = jwt;
        this.config = config;
    }
    async requestOtp(phone) {
        const code = this.config.get('SMS_PROVIDER') === 'mock'
            ? '123456'
            : String(Math.floor(100000 + Math.random() * 900000));
        await this.redis.setOtp(phone, code);
        if (this.config.get('SMS_PROVIDER') === 'mock') {
            return { message: 'OTP sent (mock)', code };
        }
        return { message: 'OTP sent' };
    }
    async verifyOtp(phone, code) {
        const stored = await this.redis.getOtp(phone);
        if (!stored || stored !== code) {
            throw new common_1.UnauthorizedException('Invalid OTP');
        }
        await this.redis.delOtp(phone);
        let user = await this.prisma.user.findUnique({ where: { phone } });
        if (!user) {
            user = await this.prisma.user.create({ data: { phone } });
        }
        return this.issueTokens(user.id, user.role);
    }
    async validateGoogleUser(profile) {
        let user = await this.prisma.user.findUnique({
            where: { googleId: profile.googleId },
        });
        if (!user && profile.email) {
            user = await this.prisma.user.findUnique({
                where: { email: profile.email },
            });
        }
        if (user) {
            user = await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    googleId: profile.googleId,
                    email: profile.email ?? user.email,
                    name: user.name ?? profile.name,
                    avatarUrl: user.avatarUrl ?? profile.avatarUrl,
                },
            });
        }
        else {
            user = await this.prisma.user.create({
                data: {
                    googleId: profile.googleId,
                    email: profile.email,
                    name: profile.name,
                    avatarUrl: profile.avatarUrl,
                },
            });
        }
        return this.issueTokens(user.id, user.role);
    }
    async refresh(refreshToken) {
        const users = await this.prisma.user.findMany({
            where: { refreshTokenHash: { not: null } },
        });
        for (const user of users) {
            if (user.refreshTokenHash &&
                (await bcrypt.compare(refreshToken, user.refreshTokenHash))) {
                return this.issueTokens(user.id, user.role);
            }
        }
        throw new common_1.UnauthorizedException('Invalid refresh token');
    }
    async logout(userId) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { refreshTokenHash: null },
        });
        return { message: 'Logged out' };
    }
    async issueTokens(userId, role) {
        const payload = { sub: userId, role };
        const accessToken = await this.jwt.signAsync(payload);
        const refreshToken = (0, crypto_1.randomBytes)(32).toString('hex');
        await this.prisma.user.update({
            where: { id: userId },
            data: { refreshTokenHash: await bcrypt.hash(refreshToken, 10) },
        });
        const user = await this.prisma.user.findUniqueOrThrow({
            where: { id: userId },
            include: { city: true, country: true },
        });
        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                phone: user.phone,
                email: user.email,
                username: user.username,
                name: user.name,
                bio: user.bio,
                avatarUrl: user.avatarUrl,
                cityId: user.cityId,
                countryId: user.countryId,
                role: user.role,
                city: user.city,
                needsOnboarding: !user.username || !user.cityId,
            },
        };
    }
    async validateUser(userId) {
        return this.prisma.user.findUnique({ where: { id: userId } });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map