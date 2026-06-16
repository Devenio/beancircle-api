import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CafeOwnershipClaimKind, CafeRole } from '@prisma/client';
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

  /** Verified cafes that have no OWNER staff yet — claimable from search. */
  listUnclaimed(q?: string) {
    return this.prisma.cafe.findMany({
      where: {
        isVerified: true,
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
        staff: { none: { role: CafeRole.OWNER } },
      },
      include: {
        photos: { take: 1, orderBy: { order: 'asc' } },
        city: true,
      },
      orderBy: { followerCount: 'desc' },
      take: 20,
    });
  }

  /** "I'm the owner" — create a pending review for an existing unowned cafe. */
  async claimOwnership(
    userId: string,
    cafeId: string,
    data: { message?: string; phone?: string },
  ) {
    const cafe = await this.prisma.cafe.findUnique({ where: { id: cafeId } });
    if (!cafe) throw new NotFoundException('Cafe not found');

    const owner = await this.prisma.cafeStaff.findFirst({
      where: { cafeId, role: CafeRole.OWNER },
    });
    if (owner) {
      throw new BadRequestException('This cafe already has an owner');
    }

    const pending = await this.prisma.cafeOwnershipClaim.findFirst({
      where: { cafeId, userId, status: 'PENDING' },
    });
    if (pending) return pending;

    return this.prisma.cafeOwnershipClaim.create({
      data: {
        cafeId,
        userId,
        kind: CafeOwnershipClaimKind.CLAIM_EXISTING,
        message: data.message,
        phone: data.phone,
      },
    });
  }

  async analytics(userId: string, cafeId: string) {
    await this.assertOwner(userId, cafeId);
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const results = await Promise.allSettled([
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

    // The first query (cafe lookup) is critical — rethrow if it failed.
    if (results[0].status === 'rejected') throw results[0].reason;
    const { value: cafe } = results[0];
    const checkins30 = results[1].status === 'fulfilled' ? results[1].value : 0;
    const checkinsTotal = results[2].status === 'fulfilled' ? results[2].value : 0;
    const reviews30 = results[3].status === 'fulfilled' ? results[3].value : 0;
    const recentCheckins = results[4].status === 'fulfilled' ? results[4].value : [];
    const stampCount = results[5].status === 'fulfilled' ? results[5].value : 0;

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
