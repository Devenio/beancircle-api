import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /** Record a super-admin action. Never throws — auditing must not break flows. */
  async log(
    actorId: string | undefined,
    action: string,
    entity?: string,
    entityId?: string,
    meta?: Prisma.InputJsonValue,
  ) {
    try {
      await this.prisma.adminAuditLog.create({
        data: { actorId: actorId ?? null, action, entity, entityId, meta },
      });
    } catch {
      // best-effort
    }
  }

  async list(cursor?: string, limit = 50) {
    const take = Math.min(limit, 100);
    const items = await this.prisma.adminAuditLog.findMany({
      include: {
        actor: { select: { id: true, username: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = items.length > take;
    const data = hasMore ? items.slice(0, take) : items;
    return { data, nextCursor: hasMore ? data[data.length - 1]?.id : null };
  }
}
