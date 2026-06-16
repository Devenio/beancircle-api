import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CafeOwnershipClaimStatus,
  CafeSuggestionStatus,
  CafeRole,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import { UpdateCafeDto } from './dto/super-admin.dto';

@Injectable()
export class CafesAdminService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  async list(params: { q?: string; cursor?: string; limit?: number }) {
    const take = Math.min(params.limit ?? 50, 100);
    const where: Prisma.CafeWhereInput = params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: 'insensitive' } },
            { address: { contains: params.q, mode: 'insensitive' } },
            { slug: { contains: params.q, mode: 'insensitive' } },
          ],
        }
      : {};
    const items = await this.prisma.cafe.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        address: true,
        avgRating: true,
        followerCount: true,
        reviewCount: true,
        isPartner: true,
        createdAt: true,
        city: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
    const hasMore = items.length > take;
    const data = hasMore ? items.slice(0, take) : items;
    return { data, nextCursor: hasMore ? data[data.length - 1]?.id : null };
  }

  async update(actorId: string, id: string, dto: UpdateCafeDto) {
    await this.assertExists(id);
    const cafe = await this.prisma.cafe.update({
      where: { id },
      data: dto,
    });
    await this.audit.log(actorId, 'cafe.update', 'cafe', id, { ...dto });
    return cafe;
  }

  async remove(actorId: string, id: string) {
    await this.assertExists(id);
    await this.prisma.cafe.delete({ where: { id } });
    await this.audit.log(actorId, 'cafe.delete', 'cafe', id);
    return { deleted: true };
  }

  // ── Cafe suggestions ──────────────────────────────────────────────────────

  listSuggestions(params: {
    status?: CafeSuggestionStatus;
    cursor?: string;
    limit?: number;
  }) {
    const take = Math.min(params.limit ?? 50, 100);
    return this.prisma.cafeSuggestion
      .findMany({
        where: params.status ? { status: params.status } : undefined,
        include: {
          user: {
            select: { id: true, username: true, name: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      })
      .then((items) => {
        const hasMore = items.length > take;
        const data = hasMore ? items.slice(0, take) : items;
        return { data, nextCursor: hasMore ? data[data.length - 1]?.id : null };
      });
  }

  async updateSuggestion(
    actorId: string,
    id: string,
    dto: { status: CafeSuggestionStatus; adminNote?: string; cityId?: string },
  ) {
    const suggestion = await this.prisma.cafeSuggestion.findUnique({ where: { id } });
    if (!suggestion) throw new NotFoundException('Suggestion not found');

    if (dto.status === CafeSuggestionStatus.APPROVED) {
      if (!dto.cityId) throw new BadRequestException('cityId is required when approving a suggestion');
      const city = await this.prisma.city.findUnique({ where: { id: dto.cityId } });
      if (!city) throw new NotFoundException('City not found');

      const slug = await this.uniqueSlug(suggestion.name);

      const [updated] = await this.prisma.$transaction([
        this.prisma.cafeSuggestion.update({
          where: { id },
          data: { status: dto.status, adminNote: dto.adminNote },
        }),
        this.prisma.cafe.create({
          data: {
            name: suggestion.name,
            slug,
            address: suggestion.address,
            lat: suggestion.lat ?? 0,
            lng: suggestion.lng ?? 0,
            cityId: city.id,
            countryId: city.countryId,
            createdById: actorId,
            isVerified: true,
          },
        }),
      ]);

      await this.audit.log(actorId, 'suggestion.approve', 'cafeSuggestion', id, dto);
      return updated;
    }

    const updated = await this.prisma.cafeSuggestion.update({
      where: { id },
      data: { status: dto.status, adminNote: dto.adminNote },
    });
    await this.audit.log(actorId, 'suggestion.update', 'cafeSuggestion', id, dto);
    return updated;
  }

  // ── Cafe ownership claims ──────────────────────────────────────────────────

  listClaims(params: {
    status?: CafeOwnershipClaimStatus;
    cursor?: string;
    limit?: number;
  }) {
    const take = Math.min(params.limit ?? 50, 100);
    return this.prisma.cafeOwnershipClaim
      .findMany({
        where: params.status ? { status: params.status } : undefined,
        include: {
          user: {
            select: { id: true, username: true, name: true, avatarUrl: true },
          },
          cafe: { select: { id: true, name: true, address: true, isVerified: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      })
      .then((items) => {
        const hasMore = items.length > take;
        const data = hasMore ? items.slice(0, take) : items;
        return { data, nextCursor: hasMore ? data[data.length - 1]?.id : null };
      });
  }

  async updateClaim(
    actorId: string,
    id: string,
    dto: { status: CafeOwnershipClaimStatus; adminNote?: string },
  ) {
    const claim = await this.prisma.cafeOwnershipClaim.findUnique({
      where: { id },
    });
    if (!claim) throw new NotFoundException('Claim not found');

    if (dto.status === CafeOwnershipClaimStatus.APPROVED) {
      await this.prisma.$transaction([
        this.prisma.cafeOwnershipClaim.update({
          where: { id },
          data: { status: dto.status, adminNote: dto.adminNote },
        }),
        this.prisma.cafe.update({
          where: { id: claim.cafeId },
          data: { isVerified: true },
        }),
        this.prisma.cafeStaff.upsert({
          where: { userId_cafeId: { userId: claim.userId, cafeId: claim.cafeId } },
          create: { userId: claim.userId, cafeId: claim.cafeId, role: CafeRole.OWNER },
          update: { role: CafeRole.OWNER },
        }),
      ]);
      await this.audit.log(actorId, 'claim.approve', 'cafeOwnershipClaim', id, dto);
      await this.notifications.create({
        userId: claim.userId,
        type: NotificationType.CAFE_OWNERSHIP_APPROVED,
        entityType: 'cafe',
        entityId: claim.cafeId,
      });
      return this.prisma.cafeOwnershipClaim.findUnique({ where: { id } });
    }

    if (dto.status === CafeOwnershipClaimStatus.REJECTED) {
      await this.prisma.$transaction([
        this.prisma.cafeOwnershipClaim.update({
          where: { id },
          data: { status: dto.status, adminNote: dto.adminNote },
        }),
        // Drop the user's ownership so the cafe leaves their list. The cafe row
        // stays (unverified → hidden from public/map, still visible to admins).
        this.prisma.cafeStaff.deleteMany({
          where: { cafeId: claim.cafeId, userId: claim.userId },
        }),
      ]);
      await this.audit.log(actorId, 'claim.reject', 'cafeOwnershipClaim', id, dto);
      await this.notifications.create({
        userId: claim.userId,
        type: NotificationType.CAFE_OWNERSHIP_REJECTED,
        entityType: 'cafe',
        entityId: claim.cafeId,
      });
      return this.prisma.cafeOwnershipClaim.findUnique({ where: { id } });
    }

    const updated = await this.prisma.cafeOwnershipClaim.update({
      where: { id },
      data: { status: dto.status, adminNote: dto.adminNote },
    });
    await this.audit.log(actorId, 'claim.update', 'cafeOwnershipClaim', id, dto);
    return updated;
  }

  private async uniqueSlug(name: string) {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48) || 'cafe';
    let slug = base;
    for (let i = 0; i < 50; i += 1) {
      const taken = await this.prisma.cafe.findUnique({ where: { slug } });
      if (!taken) return slug;
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  // ── Cafe staff / ownership ─────────────────────────────────────────────────

  getCafeStaff(cafeId: string) {
    return this.prisma.cafeStaff.findMany({
      where: { cafeId },
      include: {
        user: { select: { id: true, username: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async setCafeOwner(actorId: string, cafeId: string, userId: string) {
    await this.assertExists(cafeId);
    const staff = await this.prisma.cafeStaff.upsert({
      where: { userId_cafeId: { userId, cafeId } },
      create: { userId, cafeId, role: CafeRole.OWNER },
      update: { role: CafeRole.OWNER },
      include: {
        user: { select: { id: true, username: true, name: true, avatarUrl: true } },
      },
    });
    await this.audit.log(actorId, 'cafe.owner.set', 'cafe', cafeId, { userId });
    return staff;
  }

  async removeCafeStaff(actorId: string, cafeId: string, userId: string) {
    await this.prisma.cafeStaff.deleteMany({ where: { cafeId, userId } });
    await this.audit.log(actorId, 'cafe.staff.remove', 'cafe', cafeId, { userId });
    return { removed: true };
  }

  private async assertExists(id: string) {
    const exists = await this.prisma.cafe.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Cafe not found');
  }
}
