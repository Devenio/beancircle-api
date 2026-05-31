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
exports.PostsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const notifications_service_1 = require("../notifications/notifications.service");
let PostsService = class PostsService {
    prisma;
    notifications;
    constructor(prisma, notifications) {
        this.prisma = prisma;
        this.notifications = notifications;
    }
    async create(authorId, data) {
        const user = await this.prisma.user.findUniqueOrThrow({
            where: { id: authorId },
        });
        if (!user.cityId || !user.countryId) {
            throw new common_1.NotFoundException('Set city on profile first');
        }
        const post = await this.prisma.$transaction(async (tx) => {
            const p = await tx.post.create({
                data: {
                    authorId,
                    type: data.type,
                    caption: data.caption,
                    cafeId: data.cafeId,
                    cityId: user.cityId,
                    countryId: user.countryId,
                    photos: data.photoUrls?.length
                        ? {
                            create: data.photoUrls.map((url, order) => ({ url, order })),
                        }
                        : undefined,
                },
                include: {
                    author: {
                        select: { id: true, username: true, name: true, avatarUrl: true },
                    },
                    photos: true,
                    cafe: true,
                    _count: { select: { likes: true, comments: true } },
                },
            });
            await tx.user.update({
                where: { id: authorId },
                data: { postsCount: { increment: 1 } },
            });
            return p;
        });
        return post;
    }
    async getFeed(userId, cursor, limit = 20) {
        const following = await this.prisma.userFollow.findMany({
            where: { followerId: userId },
            select: { followingId: true },
        });
        const cafeFollows = await this.prisma.cafeFollow.findMany({
            where: { userId },
            select: { cafeId: true },
        });
        const authorIds = [...following.map((f) => f.followingId), userId];
        const cafeIds = cafeFollows.map((f) => f.cafeId);
        const items = await this.prisma.post.findMany({
            where: {
                OR: [
                    { authorId: { in: authorIds } },
                    ...(cafeIds.length ? [{ cafeId: { in: cafeIds } }] : []),
                ],
            },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            orderBy: { createdAt: 'desc' },
            include: this.postInclude(userId),
        });
        return this.paginate(items, limit);
    }
    async getById(id, userId) {
        const post = await this.prisma.post.findUnique({
            where: { id },
            include: this.postInclude(userId),
        });
        if (!post)
            throw new common_1.NotFoundException('Post not found');
        return post;
    }
    async getByUsername(username, cursor, limit = 20) {
        const user = await this.prisma.user.findUnique({
            where: { username },
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const items = await this.prisma.post.findMany({
            where: { authorId: user.id },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            orderBy: { createdAt: 'desc' },
            include: this.postInclude(),
        });
        return this.paginate(items, limit);
    }
    async save(userId, postId) {
        await this.prisma.savedPost.upsert({
            where: { userId_postId: { userId, postId } },
            create: { userId, postId },
            update: {},
        });
        return { saved: true };
    }
    async unsave(userId, postId) {
        await this.prisma.savedPost.deleteMany({ where: { userId, postId } });
        return { saved: false };
    }
    postInclude(userId) {
        return {
            author: {
                select: { id: true, username: true, name: true, avatarUrl: true },
            },
            photos: { orderBy: { order: 'asc' } },
            cafe: true,
            checkin: { include: { cafe: true } },
            _count: { select: { likes: true, comments: true } },
            ...(userId
                ? {
                    likes: { where: { userId }, take: 1 },
                    savedBy: { where: { userId }, take: 1 },
                }
                : {}),
        };
    }
    paginate(items, limit) {
        const hasMore = items.length > limit;
        const data = hasMore ? items.slice(0, limit) : items;
        return {
            data: data.map((p) => ({
                ...p,
                liked: 'likes' in p && Array.isArray(p.likes) && p.likes.length > 0,
                saved: 'savedBy' in p && Array.isArray(p.savedBy) && p.savedBy.length > 0,
            })),
            nextCursor: hasMore ? data[data.length - 1]?.id : null,
        };
    }
};
exports.PostsService = PostsService;
exports.PostsService = PostsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_service_1.NotificationsService])
], PostsService);
//# sourceMappingURL=posts.service.js.map