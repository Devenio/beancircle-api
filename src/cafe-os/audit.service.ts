import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    cafeId: string;
    actorId?: string | null;
    action: string;
    entity?: string;
    entityId?: string;
    meta?: Prisma.InputJsonValue;
  }) {
    await this.prisma.auditLog.create({
      data: {
        cafeId: params.cafeId,
        actorId: params.actorId ?? null,
        action: params.action,
        entity: params.entity ?? null,
        entityId: params.entityId ?? null,
        meta: params.meta ?? undefined,
      },
    });
  }

  async list(cafeId: string, cursor?: string, limit = 30) {
    const items = await this.prisma.auditLog.findMany({
      where: { cafeId },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
    });
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    return { data, nextCursor: hasMore ? data[data.length - 1]?.id : null };
  }
}
