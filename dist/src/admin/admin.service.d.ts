import { ReportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
export declare class AdminService {
    private prisma;
    constructor(prisma: PrismaService);
    listUsers(): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        name: string | null;
        phone: string | null;
        username: string | null;
        cityId: string | null;
        role: import("@prisma/client").$Enums.UserRole;
        createdAt: Date;
    }[]>;
    listCafes(): import("@prisma/client").Prisma.PrismaPromise<({
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
    listReviews(): import("@prisma/client").Prisma.PrismaPromise<({
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
    listReports(): import("@prisma/client").Prisma.PrismaPromise<({
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
    listCheckins(): import("@prisma/client").Prisma.PrismaPromise<({
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
    updateReport(id: string, status: ReportStatus): import("@prisma/client").Prisma.Prisma__ReportClient<{
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.ReportStatus;
        reporterId: string;
        targetType: import("@prisma/client").$Enums.ReportTargetType;
        targetId: string;
        reason: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
}
