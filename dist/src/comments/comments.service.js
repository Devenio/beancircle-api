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
exports.CommentsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const notifications_service_1 = require("../notifications/notifications.service");
let CommentsService = class CommentsService {
    prisma;
    notifications;
    constructor(prisma, notifications) {
        this.prisma = prisma;
        this.notifications = notifications;
    }
    async createOnPost(authorId, postId, body) {
        const post = await this.prisma.post.findUniqueOrThrow({
            where: { id: postId },
        });
        const comment = await this.prisma.comment.create({
            data: { authorId, postId, body },
            include: {
                author: {
                    select: { id: true, username: true, name: true, avatarUrl: true },
                },
            },
        });
        if (post.authorId !== authorId) {
            await this.notifications.create({
                userId: post.authorId,
                type: client_1.NotificationType.NEW_COMMENT,
                actorId: authorId,
                entityType: 'post',
                entityId: postId,
            });
        }
        return comment;
    }
    async createOnReview(authorId, reviewId, body) {
        const review = await this.prisma.review.findUniqueOrThrow({
            where: { id: reviewId },
        });
        const comment = await this.prisma.comment.create({
            data: { authorId, reviewId, body },
            include: {
                author: {
                    select: { id: true, username: true, name: true, avatarUrl: true },
                },
            },
        });
        if (review.authorId !== authorId) {
            await this.notifications.create({
                userId: review.authorId,
                type: client_1.NotificationType.NEW_COMMENT,
                actorId: authorId,
                entityType: 'review',
                entityId: reviewId,
            });
        }
        return comment;
    }
    listForPost(postId) {
        return this.prisma.comment.findMany({
            where: { postId },
            include: {
                author: {
                    select: { id: true, username: true, name: true, avatarUrl: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    listForReview(reviewId) {
        return this.prisma.comment.findMany({
            where: { reviewId },
            include: {
                author: {
                    select: { id: true, username: true, name: true, avatarUrl: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
};
exports.CommentsService = CommentsService;
exports.CommentsService = CommentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_service_1.NotificationsService])
], CommentsService);
//# sourceMappingURL=comments.service.js.map