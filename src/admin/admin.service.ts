import { Injectable } from '@nestjs/common';
import { ReportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

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

  async listReports(cursor?: string, limit = 50) {
    const take = Math.min(limit, 50);
    const items = await this.prisma.report.findMany({
      include: {
        reporter: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = items.length > take;
    const data = hasMore ? items.slice(0, take) : items;
    return { data, nextCursor: hasMore ? data[data.length - 1]?.id : null };
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

  updateReport(id: string, status: ReportStatus) {
    return this.prisma.report.update({ where: { id }, data: { status } });
  }
}
