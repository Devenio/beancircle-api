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
exports.GiftsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const QRCode = __importStar(require("qrcode"));
const prisma_service_1 = require("../prisma/prisma.service");
const notifications_service_1 = require("../notifications/notifications.service");
let GiftsService = class GiftsService {
    prisma;
    notifications;
    config;
    constructor(prisma, notifications, config) {
        this.prisma = prisma;
        this.notifications = notifications;
        this.config = config;
    }
    async create(senderId, amount) {
        const sender = await this.prisma.user.findUniqueOrThrow({
            where: { id: senderId },
        });
        if (!sender.cityId) {
            throw new common_1.BadRequestException('Set city on profile first');
        }
        const gift = await this.prisma.giftCoffee.create({
            data: {
                senderId,
                amount,
                cityId: sender.cityId,
                countryId: sender.countryId,
                status: client_1.GiftStatus.PENDING_PAYMENT,
                paymentRef: `mock-${Date.now()}`,
            },
        });
        if (this.config.get('PAYMENT_PROVIDER') === 'mock') {
            return this.completePayment(gift.id);
        }
        return {
            gift,
            paymentUrl: `${this.config.get('FRONTEND_URL')}/gift/pay/${gift.id}`,
        };
    }
    async completePayment(giftId) {
        const gift = await this.prisma.giftCoffee.findUniqueOrThrow({
            where: { id: giftId },
        });
        if (gift.status !== client_1.GiftStatus.PENDING_PAYMENT) {
            return gift;
        }
        const receivers = await this.prisma.user.findMany({
            where: {
                cityId: gift.cityId,
                NOT: { id: gift.senderId },
                username: { not: null },
            },
        });
        if (!receivers.length) {
            throw new common_1.BadRequestException('No receivers in city');
        }
        const receiver = receivers[Math.floor(Math.random() * receivers.length)];
        const voucherCode = `BC-${Date.now().toString(36).toUpperCase()}`;
        const updated = await this.prisma.giftCoffee.update({
            where: { id: giftId },
            data: {
                status: client_1.GiftStatus.ASSIGNED,
                receiverId: receiver.id,
                voucherCode,
            },
            include: {
                sender: { select: { id: true, name: true, username: true } },
                receiver: { select: { id: true, name: true, username: true } },
            },
        });
        await this.notifications.create({
            userId: receiver.id,
            type: client_1.NotificationType.GIFT_COFFEE,
            actorId: gift.senderId,
            entityType: 'gift',
            entityId: gift.id,
            payload: { amount: gift.amount, voucherCode },
        });
        return updated;
    }
    async getVoucher(giftId, userId) {
        const gift = await this.prisma.giftCoffee.findUniqueOrThrow({
            where: { id: giftId },
        });
        if (gift.receiverId !== userId) {
            throw new common_1.NotFoundException('Gift not found');
        }
        const qrDataUrl = gift.voucherCode
            ? await QRCode.toDataURL(gift.voucherCode)
            : null;
        return { gift, qrDataUrl };
    }
    async redeem(voucherCode, cafeId, userId) {
        const gift = await this.prisma.giftCoffee.findUnique({
            where: { voucherCode },
        });
        if (!gift || gift.status === client_1.GiftStatus.REDEEMED) {
            throw new common_1.NotFoundException('Invalid voucher');
        }
        const cafe = await this.prisma.cafe.findUniqueOrThrow({
            where: { id: cafeId },
        });
        if (!cafe.isPartner) {
            throw new common_1.BadRequestException('Cafe is not a partner');
        }
        await this.prisma.$transaction([
            this.prisma.giftCoffee.update({
                where: { id: gift.id },
                data: { status: client_1.GiftStatus.REDEEMED },
            }),
            this.prisma.voucherRedemption.create({
                data: {
                    giftId: gift.id,
                    cafeId,
                    redeemedByUserId: userId,
                },
            }),
        ]);
        return { redeemed: true };
    }
    listAll() {
        return this.prisma.giftCoffee.findMany({
            include: {
                sender: { select: { id: true, username: true, name: true } },
                receiver: { select: { id: true, username: true, name: true } },
                city: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
};
exports.GiftsService = GiftsService;
exports.GiftsService = GiftsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_service_1.NotificationsService,
        config_1.ConfigService])
], GiftsService);
//# sourceMappingURL=gifts.service.js.map