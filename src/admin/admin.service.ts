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

  updateReport(id: string, status: ReportStatus) {
    return this.prisma.report.update({ where: { id }, data: { status } });
  }
}
