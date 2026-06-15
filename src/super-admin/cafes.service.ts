import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import { UpdateCafeDto } from './dto/super-admin.dto';

@Injectable()
export class CafesAdminService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
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

  private async assertExists(id: string) {
    const exists = await this.prisma.cafe.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Cafe not found');
  }
}
