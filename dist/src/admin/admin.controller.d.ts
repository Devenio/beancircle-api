import { ReportStatus } from '@prisma/client';
import { AdminService } from './admin.service';
import { GiftsService } from '../gifts/gifts.service';
declare class UpdateReportDto {
    status: ReportStatus;
}
export declare class AdminController {
    private adminService;
    private giftsService;
    constructor(adminService: AdminService, giftsService: GiftsService);
    users(): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        name: string | null;
        phone: string | null;
        username: string | null;
        cityId: string | null;
        role: import("@prisma/client").$Enums.UserRole;
        createdAt: Date;
    }[]>;
    cafes(): import("@prisma/client").Prisma.PrismaPromise<({
        city: {
            id: string;
            name: string;
            countryId: string;
            slug: string;
        };
    } & {
        id: string;
        name: string;
        countryId: string;
        cityId: string;
        createdAt: Date;
        updatedAt: Date;
        address: string;
        lat: number;
        lng: number;
        avgRating: number;
        followerCount: number;
        reviewCount: number;
        isPartner: boolean;
    })[]>;
    reviews(): import("@prisma/client").Prisma.PrismaPromise<({
        cafe: {
            id: string;
            name: string;
        };
        author: {
            id: string;
            username: string | null;
        };
    } & {
        id: string;
        countryId: string;
        cityId: string;
        createdAt: Date;
        updatedAt: Date;
        cafeId: string;
        authorId: string;
        body: string | null;
        rating: number;
    })[]>;
    reports(): import("@prisma/client").Prisma.PrismaPromise<({
        reporter: {
            id: string;
            username: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.ReportStatus;
        reporterId: string;
        targetType: import("@prisma/client").$Enums.ReportTargetType;
        targetId: string;
        reason: string;
    })[]>;
    checkins(): import("@prisma/client").Prisma.PrismaPromise<({
        user: {
            id: string;
            username: string | null;
        };
        cafe: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        countryId: string;
        cityId: string;
        createdAt: Date;
        userId: string;
        cafeId: string;
    })[]>;
    gifts(): import("@prisma/client").Prisma.PrismaPromise<({
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
    updateReport(id: string, dto: UpdateReportDto): import("@prisma/client").Prisma.Prisma__ReportClient<{
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.ReportStatus;
        reporterId: string;
        targetType: import("@prisma/client").$Enums.ReportTargetType;
        targetId: string;
        reason: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
}
export {};
