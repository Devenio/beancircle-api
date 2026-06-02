import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BeanScoreAction } from '@prisma/client';
import { randomBytes } from 'crypto';
import { BeanScoreService } from '../beanscore/beanscore.service';
import { PrismaService } from '../prisma/prisma.service';

const REFERRAL_POINTS = 50;

@Injectable()
export class GrowthService {
  constructor(
    private prisma: PrismaService,
    private beanScore: BeanScoreService,
  ) {}

  private generateCode() {
    return randomBytes(4).toString('hex').toUpperCase();
  }

  async ensureReferralCode(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.referralCode) return user.referralCode;

    for (let i = 0; i < 5; i++) {
      const code = this.generateCode();
      try {
        await this.prisma.user.update({
          where: { id: userId },
          data: { referralCode: code },
        });
        return code;
      } catch {
        /* collision */
      }
    }
    throw new BadRequestException('Could not generate referral code');
  }

  async getReferralStats(userId: string) {
    const code = await this.ensureReferralCode(userId);
    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        referred: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
    });
    const total = await this.prisma.referral.count({
      where: { referrerId: userId },
    });
    return {
      code,
      total,
      pointsEarned: referrals.reduce((s, r) => s + r.pointsAwarded, 0),
      referrals,
    };
  }

  async applyReferralCode(userId: string, code: string) {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      throw new BadRequestException('Referral code required');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const existingReferral = await this.prisma.referral.findUnique({
      where: { referredUserId: userId },
    });
    if (user.referredById || existingReferral) {
      throw new BadRequestException('Referral already applied');
    }

    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: normalized },
    });
    if (!referrer) {
      throw new NotFoundException('Invalid referral code');
    }
    if (referrer.id === userId) {
      throw new BadRequestException('Cannot use your own code');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { referredById: referrer.id },
      });
      await tx.referral.create({
        data: {
          referrerId: referrer.id,
          referredUserId: userId,
          pointsAwarded: REFERRAL_POINTS,
        },
      });
    });

    await this.beanScore.award(
      referrer.id,
      BeanScoreAction.REFERRAL,
      userId,
      REFERRAL_POINTS,
    );

    return { applied: true, referrerId: referrer.id };
  }
}
