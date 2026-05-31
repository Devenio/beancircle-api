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
exports.CafesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let CafesService = class CafesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    list(cityId, q) {
        return this.prisma.cafe.findMany({
            where: {
                ...(cityId ? { cityId } : {}),
                ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
            },
            include: { photos: { take: 1, orderBy: { order: 'asc' } }, city: true },
            orderBy: { followerCount: 'desc' },
            take: 50,
        });
    }
    async get(id, userId) {
        const cafe = await this.prisma.cafe.findUnique({
            where: { id },
            include: {
                photos: { orderBy: { order: 'asc' } },
                city: true,
                reviews: {
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        author: {
                            select: { id: true, username: true, name: true, avatarUrl: true },
                        },
                        photos: true,
                    },
                },
            },
        });
        if (!cafe)
            throw new common_1.NotFoundException('Cafe not found');
        let isFollowing = false;
        if (userId) {
            const f = await this.prisma.cafeFollow.findUnique({
                where: { userId_cafeId: { userId, cafeId: id } },
            });
            isFollowing = !!f;
        }
        return { ...cafe, isFollowing };
    }
    async follow(userId, cafeId) {
        await this.prisma.$transaction([
            this.prisma.cafeFollow.upsert({
                where: { userId_cafeId: { userId, cafeId } },
                create: { userId, cafeId },
                update: {},
            }),
            this.prisma.cafe.update({
                where: { id: cafeId },
                data: { followerCount: { increment: 1 } },
            }),
        ]);
        return { following: true };
    }
    async unfollow(userId, cafeId) {
        const r = await this.prisma.cafeFollow.deleteMany({
            where: { userId, cafeId },
        });
        if (r.count) {
            await this.prisma.cafe.update({
                where: { id: cafeId },
                data: { followerCount: { decrement: 1 } },
            });
        }
        return { following: false };
    }
    create(data) {
        return this.prisma.cafe.create({ data });
    }
    update(id, data) {
        return this.prisma.cafe.update({ where: { id }, data });
    }
};
exports.CafesService = CafesService;
exports.CafesService = CafesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CafesService);
//# sourceMappingURL=cafes.service.js.map