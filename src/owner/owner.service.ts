import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OwnerService {
  constructor(private prisma: PrismaService) {}

  async assertOwner(userId: string, cafeId: string) {
    const row = await this.prisma.cafeOwner.findUnique({
      where: { userId_cafeId: { userId, cafeId } },
    });
    if (!row) throw new ForbiddenException('Not a cafe owner');
  }

  listCafes(userId: string) {
    return this.prisma.cafeOwner.findMany({
      where: { userId },
      include: {
        cafe: {
          include: {
            photos: { take: 1, orderBy: { order: 'asc' } },
            city: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async claimCafe(userId: string, claimCode: string) {
    const cafe = await this.prisma.cafe.findUnique({
      where: { claimCode: claimCode.trim().toUpperCase() },
    });
    if (!cafe) {
      throw new NotFoundException('Invalid claim code');
    }
    const existing = await this.prisma.cafeOwner.findUnique({
      where: { userId_cafeId: { userId, cafeId: cafe.id } },
    });
    if (existing) {
      return { cafe, alreadyOwned: true };
    }
    await this.prisma.cafeOwner.create({
      data: { userId, cafeId: cafe.id },
    });
    return { cafe, alreadyOwned: false };
  }

  async analytics(userId: string, cafeId: string) {
    await this.assertOwner(userId, cafeId);
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      cafe,
      checkins30,
      checkinsTotal,
      reviews30,
      recentCheckins,
      stampCount,
    ] = await Promise.all([
      this.prisma.cafe.findUniqueOrThrow({
        where: { id: cafeId },
        select: {
          id: true,
          name: true,
          followerCount: true,
          reviewCount: true,
          avgRating: true,
          isPartner: true,
          checkinCode: true,
        },
      }),
      this.prisma.checkin.count({
        where: { cafeId, createdAt: { gte: since30 } },
      }),
      this.prisma.checkin.count({ where: { cafeId } }),
      this.prisma.review.count({
        where: { cafeId, createdAt: { gte: since30 } },
      }),
      this.prisma.checkin.findMany({
        where: { cafeId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: { id: true, username: true, name: true, avatarUrl: true },
          },
        },
      }),
      this.prisma.stamp.count({ where: { cafeId } }),
    ]);

    return {
      cafe,
      metrics: {
        checkins30,
        checkinsTotal,
        reviews30,
        stampCount,
      },
      recentCheckins,
    };
  }

  async updateCafe(
    userId: string,
    cafeId: string,
    data: {
      name?: string;
      address?: string;
      isPartner?: boolean;
      bestCoffee?: boolean;
      bestWorkspace?: boolean;
      quiet?: boolean;
      studyFriendly?: boolean;
      fastWifi?: boolean;
    },
  ) {
    await this.assertOwner(userId, cafeId);
    if (!Object.keys(data).length) {
      throw new BadRequestException('No fields to update');
    }
    const existing = await this.prisma.cafe.findUnique({ where: { id: cafeId } });
    const codes: { checkinCode?: string; claimCode?: string } = {};
    if (data.isPartner && existing && !existing.checkinCode) {
      codes.checkinCode = `BC-${randomBytes(4).toString('hex').toUpperCase()}`;
    }
    if (data.isPartner && existing && !existing.claimCode) {
      codes.claimCode = `CLM-${randomBytes(4).toString('hex').toUpperCase()}`;
    }
    return this.prisma.cafe.update({
      where: { id: cafeId },
      data: { ...data, ...codes },
      include: { photos: { take: 1 }, city: true },
    });
  }
}
