import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReportStatus, ReportTargetType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../super-admin/audit.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

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

  async listReports(cursor?: string, status?: ReportStatus, limit = 50) {
    const take = Math.min(limit, 50);
    const items = await this.prisma.report.findMany({
      include: {
        reporter: { select: { id: true, username: true, name: true } },
      },
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = items.length > take;
    const data = hasMore ? items.slice(0, take) : items;

    const enriched = await Promise.all(
      data.map((r) => this.enrichReport(r)),
    );

    return { data: enriched, nextCursor: hasMore ? data[data.length - 1]?.id : null };
  }

  async getReport(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        reporter: { select: { id: true, username: true, name: true, avatarUrl: true } },
      },
    });
    if (!report) throw new NotFoundException('Report not found');
    return this.enrichReport(report);
  }

  updateReport(id: string, status: ReportStatus) {
    return this.prisma.report.update({ where: { id }, data: { status } });
  }

  async resolveReport(actorId: string, id: string, adminNote?: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    const updated = await this.prisma.report.update({
      where: { id },
      data: { status: ReportStatus.RESOLVED, adminNote: adminNote ?? null },
    });
    await this.audit.log(actorId, 'report.resolve', 'report', id, {
      targetType: report.targetType,
      targetId: report.targetId,
      adminNote,
    });
    return updated;
  }

  async dismissReport(actorId: string, id: string, adminNote?: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    const updated = await this.prisma.report.update({
      where: { id },
      data: { status: ReportStatus.DISMISSED, adminNote: adminNote ?? null },
    });
    await this.audit.log(actorId, 'report.dismiss', 'report', id, {
      targetType: report.targetType,
      targetId: report.targetId,
      adminNote,
    });
    return updated;
  }

  async removeContent(actorId: string, reportId: string) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');

    const { targetType, targetId } = report;

    switch (targetType) {
      case ReportTargetType.POST:
        await this.prisma.post.delete({ where: { id: targetId } });
        break;
      case ReportTargetType.REVIEW:
        await this.prisma.review.delete({ where: { id: targetId } });
        break;
      case ReportTargetType.MESSAGE:
        await this.prisma.message.delete({ where: { id: targetId } });
        break;
      case ReportTargetType.USER: {
        const user = await this.prisma.user.findUnique({ where: { id: targetId }, select: { role: true } });
        if (user?.role === UserRole.SUPER_ADMIN) {
          throw new ForbiddenException('Cannot remove a super admin');
        }
        await this.prisma.user.update({
          where: { id: targetId },
          data: { status: 'BANNED', bannedAt: new Date() },
        });
        break;
      }
      case ReportTargetType.CAFE:
        await this.prisma.cafe.delete({ where: { id: targetId } });
        break;
    }

    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: { status: ReportStatus.RESOLVED, adminNote: 'Content removed by moderator' },
    });

    await this.audit.log(actorId, 'report.remove_content', 'report', reportId, {
      targetType,
      targetId,
    });

    return updated;
  }

  async warnUser(actorId: string, userId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot warn a super admin');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { warningCount: { increment: 1 } },
      select: {
        id: true,
        username: true,
        name: true,
        warningCount: true,
        status: true,
      },
    });

    await this.audit.log(actorId, 'user.warn', 'user', userId, {
      warningCount: updated.warningCount,
      reason,
    });

    return updated;
  }

  private async enrichReport(report: Record<string, unknown>) {
    const r = report as { targetType: ReportTargetType; targetId: string; reporterId: string };
    let targetPreview: Record<string, unknown> | null = null;

    switch (r.targetType) {
      case ReportTargetType.USER: {
        const user = await this.prisma.user.findUnique({
          where: { id: r.targetId },
          select: {
            id: true, username: true, name: true, avatarUrl: true,
            status: true, warningCount: true, createdAt: true,
            postsCount: true, _count: { select: { reports: true } },
          },
        });
        targetPreview = user;
        break;
      }
      case ReportTargetType.POST: {
        const post = await this.prisma.post.findUnique({
          where: { id: r.targetId },
          select: {
            id: true, caption: true, type: true, createdAt: true,
            author: { select: { id: true, username: true, name: true } },
          },
        });
        targetPreview = post;
        break;
      }
      case ReportTargetType.REVIEW: {
        const review = await this.prisma.review.findUnique({
          where: { id: r.targetId },
          select: {
            id: true, body: true, rating: true, createdAt: true,
            author: { select: { id: true, username: true, name: true } },
            cafe: { select: { id: true, name: true } },
          },
        });
        targetPreview = review;
        break;
      }
      case ReportTargetType.MESSAGE: {
        const msg = await this.prisma.message.findUnique({
          where: { id: r.targetId },
          select: {
            id: true, body: true, type: true, createdAt: true,
            sender: { select: { id: true, username: true, name: true } },
          },
        });
        targetPreview = msg;
        break;
      }
      case ReportTargetType.CAFE: {
        const cafe = await this.prisma.cafe.findUnique({
          where: { id: r.targetId },
          select: {
            id: true, name: true, address: true, createdAt: true,
          },
        });
        targetPreview = cafe;
        break;
      }
    }

    return { ...report, targetPreview };
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
}
