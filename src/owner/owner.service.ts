import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CafeRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const EDIT_ROLES: CafeRole[] = [CafeRole.OWNER, CafeRole.MANAGER];

@Injectable()
export class OwnerService {
  constructor(private prisma: PrismaService) {}

  /** Any staff member of the cafe. */
  async assertStaff(userId: string, cafeId: string, roles?: CafeRole[]) {
    const row = await this.prisma.cafeStaff.findUnique({
      where: { userId_cafeId: { userId, cafeId } },
    });
    if (!row) throw new ForbiddenException('Not a member of this cafe');
    if (roles?.length && !roles.includes(row.role)) {
      throw new ForbiddenException('Insufficient cafe role');
    }
    return row;
  }

  /** Back-compat: owner/manager level access. */
  async assertOwner(userId: string, cafeId: string) {
    await this.assertStaff(userId, cafeId, EDIT_ROLES);
  }

  listCafes(userId: string) {
    return this.prisma.cafeStaff.findMany({
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
    const existing = await this.prisma.cafeStaff.findUnique({
      where: { userId_cafeId: { userId, cafeId: cafe.id } },
    });
    if (existing) {
      return { cafe, alreadyOwned: true };
    }
    await this.prisma.cafeStaff.create({
      data: { userId, cafeId: cafe.id, role: CafeRole.OWNER },
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
