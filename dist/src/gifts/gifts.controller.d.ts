import { GiftsService } from './gifts.service';
declare class CreateGiftDto {
    amount: number;
}
declare class RedeemDto {
    voucherCode: string;
    cafeId: string;
}
export declare class GiftsController {
    private giftsService;
    constructor(giftsService: GiftsService);
    create(user: {
        id: string;
    }, dto: CreateGiftDto): Promise<{
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
    webhook(giftId: string): Promise<{
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
    voucher(user: {
        id: string;
    }, id: string): Promise<{
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
    redeem(user: {
        id: string;
    }, dto: RedeemDto): Promise<{
        redeemed: boolean;
    }>;
    list(): import("@prisma/client").Prisma.PrismaPromise<({
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
export {};
