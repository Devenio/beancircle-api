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
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AdminService = class AdminService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    listUsers() {
        return this.prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100,
            select: {
                id: true,
                username: true,
                name: true,
                phone: true,
                role: true,
                cityId: true,
                createdAt: true,
            },
        });
    }
    listCafes() {
        return this.prisma.cafe.findMany({
            include: { city: true },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
    listReviews() {
        return this.prisma.review.findMany({
            include: {
                author: { select: { id: true, username: true } },
                cafe: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
    listReports() {
        return this.prisma.report.findMany({
            include: {
                reporter: { select: { id: true, username: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    listCheckins() {
        return this.prisma.checkin.findMany({
            include: {
                user: { select: { id: true, username: true } },
                cafe: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
    updateReport(id, status) {
        return this.prisma.report.update({ where: { id }, data: { status } });
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminService);
//# sourceMappingURL=admin.service.js.map