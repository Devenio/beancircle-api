import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
export declare class GiftsService {
    private prisma;
    private notifications;
    private config;
    constructor(prisma: PrismaService, notifications: NotificationsService, config: ConfigService);
    create(senderId: string, amount: number): Promise<{
        id: string;
        countryId: string;
        cityId: string;
        createdAt: Date;
        updatedAt: Date;
        senderId: string;
        amount: number;
        status: import("@prisma/client").$Enums.GiftStatus;
        paymentRef: string | null;
        voucherCode: string | null;
        receiverId: string | null;
    } | {
        gift: {
            id: string;
            countryId: string;
            cityId: string;
            createdAt: Date;
            updatedAt: Date;
            senderId: string;
            amount: number;
            status: import("@prisma/client").$Enums.GiftStatus;
            paymentRef: string | null;
            voucherCode: string | null;
            receiverId: string | null;
        };
        paymentUrl: string;
    }>;
    completePayment(giftId: string): Promise<{
        id: string;
        countryId: string;
        cityId: string;
        createdAt: Date;
        updatedAt: Date;
        senderId: string;
        amount: number;
        status: import("@prisma/client").$Enums.GiftStatus;
        paymentRef: string | null;
        voucherCode: string | null;
        receiverId: string | null;
    }>;
    getVoucher(giftId: string, userId: string): Promise<{
        gift: {
            id: string;
            countryId: string;
            cityId: string;
            createdAt: Date;
            updatedAt: Date;
            senderId: string;
            amount: number;
            status: import("@prisma/client").$Enums.GiftStatus;
            paymentRef: string | null;
            voucherCode: string | null;
            receiverId: string | null;
        };
        qrDataUrl: string | null;
    }>;
    redeem(voucherCode: string, cafeId: string, userId?: string): Promise<{
        redeemed: boolean;
    }>;
    listAll(): import("@prisma/client").Prisma.PrismaPromise<({
        city: {
            id: string;
            name: string;
            countryId: string;
            slug: string;
        };
        sender: {
            id: string;
            name: string | null;
            username: string | null;
        };
        receiver: {
            id: string;
            name: string | null;
            username: string | null;
        } | null;
    } & {
        id: string;
        countryId: string;
        cityId: string;
        createdAt: Date;
        updatedAt: Date;
        senderId: string;
        amount: number;
        status: import("@prisma/client").$Enums.GiftStatus;
        paymentRef: string | null;
        voucherCode: string | null;
        receiverId: string | null;
    })[]>;
}
