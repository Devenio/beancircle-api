import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkService {
  constructor(private prisma: PrismaService) {}

  async submitReport(
    userId: string,
    cafeId: string,
    data: { wifiScore: number; noiseLevel: number; outletScore: number },
  ) {
    for (const v of [data.wifiScore, data.noiseLevel, data.outletScore]) {
      if (v < 1 || v > 5) {
        throw new BadRequestException('Scores must be between 1 and 5');
      }
    }

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const todayCount = await this.prisma.workReport.count({
      where: { userId, cafeId, createdAt: { gte: dayStart } },
    });
    if (todayCount >= 1) {
      throw new BadRequestException('Already submitted a work report today for this cafe');
    }

    await this.prisma.workReport.create({
      data: { userId, cafeId, ...data },
    });

    return this.refreshCafeScores(cafeId);
  }

  async getInsights(cafeId: string) {
    const cafe = await this.prisma.cafe.findUnique({
      where: { id: cafeId },
      select: {
        workspaceScore: true,
        liveWifiScore: true,
        liveNoiseLevel: true,
        liveOutletScore: true,
        workReportCount: true,
        bestWorkspace: true,
        fastWifi: true,
        quiet: true,
      },
    });
    if (!cafe) throw new BadRequestException('Cafe not found');

    const workFriendlyScore = this.computeWorkFriendlyScore(cafe);
    return { ...cafe, workFriendlyScore };
  }

  private async refreshCafeScores(cafeId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const reports = await this.prisma.workReport.findMany({
      where: { cafeId, createdAt: { gte: since } },
    });
    if (!reports.length) {
      return this.getInsights(cafeId);
    }
    const avg = (key: 'wifiScore' | 'noiseLevel' | 'outletScore') =>
      reports.reduce((s, r) => s + r[key], 0) / reports.length;

    const liveWifiScore = avg('wifiScore');
    const liveNoiseLevel = avg('noiseLevel');
    const liveOutletScore = avg('outletScore');

    await this.prisma.cafe.update({
      where: { id: cafeId },
      data: {
        liveWifiScore,
        liveNoiseLevel,
        liveOutletScore,
        workReportCount: reports.length,
        workspaceScore: Math.round(
          ((liveWifiScore + liveOutletScore + (6 - liveNoiseLevel)) / 15) * 100,
        ),
        bestWorkspace: liveWifiScore >= 4 && liveOutletScore >= 3,
        fastWifi: liveWifiScore >= 4,
        quiet: liveNoiseLevel <= 2,
      },
    });

    return this.getInsights(cafeId);
  }

  private computeWorkFriendlyScore(cafe: {
    workspaceScore: number;
    liveWifiScore: number | null;
    liveNoiseLevel: number | null;
    liveOutletScore: number | null;
    workReportCount: number;
  }) {
    if (cafe.workReportCount === 0) {
      return cafe.workspaceScore;
    }
    const wifi = cafe.liveWifiScore ?? 3;
    const noise = cafe.liveNoiseLevel ?? 3;
    const outlets = cafe.liveOutletScore ?? 3;
    return Math.round(((wifi + outlets + (6 - noise)) / 15) * 100);
  }
}
