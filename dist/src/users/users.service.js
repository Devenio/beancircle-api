"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const notifications_service_1 = require("../notifications/notifications.service");
const userSelect = {
    id: true,
    username: true,
    name: true,
    bio: true,
    avatarUrl: true,
    cityId: true,
    countryId: true,
    role: true,
    postsCount: true,
    followersCount: true,
    followingCount: true,
    createdAt: true,
    city: true,
};
let UsersService = class UsersService {
    prisma;
    notifications;
    constructor(prisma, notifications) {
        this.prisma = prisma;
        this.notifications = notifications;
    }
    getMe(userId) {
        return this.prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { ...userSelect, phone: true, email: true },
        });
    }
    async updateMe(userId, dto) {
        if (dto.username) {
            const taken = await this.prisma.user.findFirst({
                where: { username: dto.username, NOT: { id: userId } },
            });
            if (taken)
                throw new common_1.ConflictException('Username taken');
        }
        if (dto.cityId) {
            const city = await this.prisma.city.findUnique({ where: { id: dto.cityId } });
            if (!city)
                throw new common_1.BadRequestException('Invalid city');
            return this.prisma.user.update({
                where: { id: userId },
                data: { ...dto, countryId: city.countryId },
                select: userSelect,
            });
        }
        return this.prisma.user.update({
            where: { id: userId },
            data: dto,
            select: userSelect,
        });
    }
    async getByUsername(username, viewerId) {
        const user = await this.prisma.user.findUnique({
            where: { username },
            select: {
                ...userSelect,
                favoriteCafes: {
                    include: { cafe: { include: { photos: { take: 1 } } } },
                },
            },
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        let isFollowing = false;
        if (viewerId && viewerId !== user.id) {
            const follow = await this.prisma.userFollow.findUnique({
                where: {
                    followerId_followingId: { followerId: viewerId, followingId: user.id },
                },
            });
            isFollowing = !!follow;
        }
        return { ...user, isFollowing, isSelf: viewerId === user.id };
    }
    async follow(followerId, followingId) {
        if (followerId === followingId) {
            throw new common_1.BadRequestException('Cannot follow yourself');
        }
        const target = await this.prisma.user.findUnique({ where: { id: followingId } });
        if (!target)
            throw new common_1.NotFoundException('User not found');
        await this.prisma.$transaction(async (tx) => {
            await tx.userFollow.upsert({
                where: {
                    followerId_followingId: { followerId, followingId },
                },
                create: { followerId, followingId },
                update: {},
            });
            await tx.user.update({
                where: { id: followerId },
                data: { followingCount: { increment: 1 } },
            });
            await tx.user.update({
                where: { id: followingId },
                data: { followersCount: { increment: 1 } },
            });
        });
        await this.notifications.create({
            userId: followingId,
            type: client_1.NotificationType.NEW_FOLLOWER,
            actorId: followerId,
            entityType: 'user',
            entityId: followerId,
        });
        return { following: true };
    }
    async unfollow(followerId, followingId) {
        const deleted = await this.prisma.userFollow.deleteMany({
            where: { followerId, followingId },
        });
        if (deleted.count) {
            await this.prisma.user.update({
                where: { id: followerId },
                data: { followingCount: { decrement: 1 } },
            });
            await this.prisma.user.update({
                where: { id: followingId },
                data: { followersCount: { decrement: 1 } },
            });
        }
        return { following: false };
    }
    async getFavoriteCafes(userId) {
        return this.prisma.favoriteCafe.findMany({
            where: { userId },
            include: { cafe: { include: { photos: { take: 1 } } } },
        });
    }
    async addFavoriteCafe(userId, cafeId) {
        const cafe = await this.prisma.cafe.findUniqueOrThrow({ where: { id: cafeId } });
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        return this.prisma.favoriteCafe.upsert({
            where: { userId_cafeId: { userId, cafeId } },
            create: { userId, cafeId, cityId: user.cityId ?? cafe.cityId },
            update: {},
            include: { cafe: true },
        });
    }
    async removeFavoriteCafe(userId, cafeId) {
        await this.prisma.favoriteCafe.deleteMany({ where: { userId, cafeId } });
        return { removed: true };
    }
    listCities() {
        return this.prisma.city.findMany({
            include: { country: true },
            orderBy: { name: 'asc' },
        });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_service_1.NotificationsService])
], UsersService);
//# sourceMappingURL=users.service.js.map