import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as QRCode from 'qrcode';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const DAILY_WINNER_LIMIT = 10;

export type DailyWinResult = {
  id: string;
  voucherCode: string;
  cafeId: string;
  cafeName: string;
  redeemed: boolean;
  isNewWin: boolean;
};

@Injectable()
export class PromotionsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private startOfUtcDay() {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private todayDate() {
    const d = this.startOfUtcDay();
    return new Date(d.toISOString().slice(0, 10));
  }

  private generateVoucherCode() {
    return `BC-FREE-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private toWinResult(
    winner: {
      id: string;
      voucherCode: string;
      redeemedAt: Date | null;
      draw: { cafe: { id: string; name: string } };
    },
    isNewWin: boolean,
  ): DailyWinResult {
    return {
      id: winner.id,
      voucherCode: winner.voucherCode,
      cafeId: winner.draw.cafe.id,
      cafeName: winner.draw.cafe.name,
      redeemed: winner.redeemedAt != null,
      isNewWin,
    };
  }

  async tryWinOnCheckin(
    userId: string,
    cafeId: string,
    checkinId: string,
    isPartner: boolean,
  ): Promise<DailyWinResult | null> {
    if (!isPartner) return null;

    const day = this.todayDate();
    const dayStart = this.startOfUtcDay();

    const existing = await this.prisma.cafeDailyDrawWinner.findFirst({
      where: {
        userId,
        draw: { cafeId, day },
      },
      include: { draw: { include: { cafe: true } } },
    });
    if (existing) {
      return this.toWinResult(existing, false);
    }

    const draw = await this.prisma.cafeDailyDraw.upsert({
      where: { cafeId_day: { cafeId, day } },
      create: { cafeId, day, winnerCount: 0, maxWinners: DAILY_WINNER_LIMIT },
      update: {},
    });

    if (draw.winnerCount >= draw.maxWinners) return null;

    const checkinCount = await this.prisma.checkin.count({
      where: { cafeId, createdAt: { gte: dayStart } },
    });
    if (checkinCount < 1) return null;

    const remaining = draw.maxWinners - draw.winnerCount;
    const won = Math.random() < remaining / checkinCount;
    if (!won) return null;

    try {
      const winner = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.cafeDailyDraw.updateMany({
          where: { id: draw.id, winnerCount: { lt: draw.maxWinners } },
          data: { winnerCount: { increment: 1 } },
        });
        if (updated.count === 0) return null;

        return tx.cafeDailyDrawWinner.create({
          data: {
            drawId: draw.id,
            userId,
            checkinId,
            voucherCode: this.generateVoucherCode(),
            notifiedAt: new Date(),
          },
          include: { draw: { include: { cafe: true } } },
        });
      });

      if (!winner) return null;

      await this.notifications.create({
        userId,
        type: NotificationType.CAFE_DAILY_WIN,
        entityType: 'cafe_daily_win',
        entityId: winner.id,
        payload: {
          cafeName: winner.draw.cafe.name,
          voucherCode: winner.voucherCode,
        },
      });

      return this.toWinResult(winner, true);
    } catch {
      return null;
    }
  }

  async getMyWinsToday(userId: string) {
    const day = this.todayDate();
    const winners = await this.prisma.cafeDailyDrawWinner.findMany({
      where: { userId, draw: { day } },
      include: { draw: { include: { cafe: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      wins: winners.map((w) => ({
        id: w.id,
        voucherCode: w.voucherCode,
        redeemed: w.redeemedAt != null,
        cafe: w.draw.cafe,
        wonAt: w.createdAt,
      })),
    };
  }

  async getCafeStatus(userId: string, cafeId: string) {
    const day = this.todayDate();
    const draw = await this.prisma.cafeDailyDraw.findUnique({
      where: { cafeId_day: { cafeId, day } },
    });

    const myWin = await this.prisma.cafeDailyDrawWinner.findFirst({
      where: { userId, draw: { cafeId, day } },
      include: { draw: { include: { cafe: true } } },
    });

    return {
      maxWinners: DAILY_WINNER_LIMIT,
      winnersToday: draw?.winnerCount ?? 0,
      slotsRemaining: Math.max(0, DAILY_WINNER_LIMIT - (draw?.winnerCount ?? 0)),
      myWin: myWin
        ? {
            id: myWin.id,
            voucherCode: myWin.voucherCode,
            redeemed: myWin.redeemedAt != null,
          }
        : null,
    };
  }

  async getVoucherQr(winnerId: string, userId: string) {
    const winner = await this.prisma.cafeDailyDrawWinner.findUnique({
      where: { id: winnerId },
      include: { draw: { include: { cafe: true } } },
    });
    if (!winner || winner.userId !== userId) {
      throw new NotFoundException('Voucher not found');
    }
    const qrDataUrl = await QRCode.toDataURL(winner.voucherCode);
    return {
      voucherCode: winner.voucherCode,
      qrDataUrl,
      redeemed: winner.redeemedAt != null,
      cafe: winner.draw.cafe,
    };
  }

  async redeem(voucherCode: string, cafeId: string) {
    const winner = await this.prisma.cafeDailyDrawWinner.findUnique({
      where: { voucherCode },
      include: { draw: { include: { cafe: true } } },
    });
    if (!winner) {
      throw new NotFoundException('Invalid voucher');
    }
    if (winner.redeemedAt) {
      throw new BadRequestException('Voucher already redeemed');
    }
    if (winner.draw.cafe.id !== cafeId) {
      throw new BadRequestException('Voucher is not valid at this cafe');
    }
    const cafe = await this.prisma.cafe.findUniqueOrThrow({
      where: { id: cafeId },
    });
    if (!cafe.isPartner) {
      throw new BadRequestException('Cafe is not a partner');
    }

    const day = this.todayDate();
    if (winner.draw.day.getTime() !== day.getTime()) {
      throw new BadRequestException('Voucher expired — valid only on the day you won');
    }

    await this.prisma.cafeDailyDrawWinner.update({
      where: { id: winner.id },
      data: { redeemedAt: new Date() },
    });

    return { redeemed: true, cafeName: cafe.name };
  }
}
