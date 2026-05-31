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
exports.CheckinsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
let CheckinsService = class CheckinsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(userId, cafeId) {
        const user = await this.prisma.user.findUniqueOrThrow({
            where: { id: userId },
        });
        const cafe = await this.prisma.cafe.findUniqueOrThrow({
            where: { id: cafeId },
        });
        if (!user.cityId) {
            throw new common_1.BadRequestException('Complete profile with city first');
        }
        const checkin = await this.prisma.checkin.create({
            data: {
                userId,
                cafeId,
                cityId: cafe.cityId,
                countryId: cafe.countryId,
            },
            include: {
                cafe: true,
                user: { select: { id: true, username: true, name: true, avatarUrl: true } },
            },
        });
        await this.prisma.post.create({
            data: {
                authorId: userId,
                cafeId,
                checkinId: checkin.id,
                type: client_1.PostType.CHECKIN,
                caption: `${user.name ?? user.username} checked in at ${cafe.name}`,
                cityId: cafe.cityId,
                countryId: cafe.countryId,
            },
        });
        return checkin;
    }
    list(userId) {
        return this.prisma.checkin.findMany({
            where: userId ? { userId } : {},
            include: {
                cafe: { include: { photos: { take: 1 } } },
                user: { select: { id: true, username: true, name: true, avatarUrl: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
};
exports.CheckinsService = CheckinsService;
exports.CheckinsService = CheckinsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CheckinsService);
//# sourceMappingURL=checkins.service.js.map