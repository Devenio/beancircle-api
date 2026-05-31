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
exports.ReviewsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ReviewsService = class ReviewsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(authorId, cafeId, data) {
        const user = await this.prisma.user.findUniqueOrThrow({
            where: { id: authorId },
        });
        const cafe = await this.prisma.cafe.findUniqueOrThrow({
            where: { id: cafeId },
        });
        const review = await this.prisma.review.create({
            data: {
                cafeId,
                authorId,
                rating: data.rating,
                body: data.body,
                cityId: cafe.cityId,
                countryId: cafe.countryId,
                photos: data.photoUrls?.length
                    ? { create: data.photoUrls.map((url) => ({ url })) }
                    : undefined,
            },
            include: {
                author: {
                    select: { id: true, username: true, name: true, avatarUrl: true },
                },
                photos: true,
            },
        });
        const agg = await this.prisma.review.aggregate({
            where: { cafeId },
            _avg: { rating: true },
            _count: true,
        });
        await this.prisma.cafe.update({
            where: { id: cafeId },
            data: {
                avgRating: agg._avg.rating ?? 0,
                reviewCount: agg._count,
            },
        });
        return review;
    }
    listByCafe(cafeId) {
        return this.prisma.review.findMany({
            where: { cafeId },
            include: {
                author: {
                    select: { id: true, username: true, name: true, avatarUrl: true },
                },
                photos: true,
                _count: { select: { likes: true, comments: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
};
exports.ReviewsService = ReviewsService;
exports.ReviewsService = ReviewsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReviewsService);
//# sourceMappingURL=reviews.service.js.map