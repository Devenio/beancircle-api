import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import { UpdateUserStatusDto } from './dto/super-admin.dto';

const userSummary = {
  id: true,
  username: true,
  name: true,
  phone: true,
  email: true,
  avatarUrl: true,
  role: true,
  status: true,
  suspendedUntil: true,
  bannedAt: true,
  cityId: true,
  createdAt: true,
  lastSeenAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersAdminService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async list(params: {
    q?: string;
    role?: UserRole;
    status?: UserStatus;
    cursor?: string;
    limit?: number;
  }) {
    const take = Math.min(params.limit ?? 50, 100);
    const where: Prisma.UserWhereInput = {
      ...(params.role ? { role: params.role } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.q
        ? {
            OR: [
              { username: { contains: params.q, mode: 'insensitive' } },
              { name: { contains: params.q, mode: 'insensitive' } },
              { phone: { contains: params.q } },
              { email: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const items = await this.prisma.user.findMany({
      where,
      select: userSummary,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
    const hasMore = items.length > take;
    const data = hasMore ? items.slice(0, take) : items;
    return { data, nextCursor: hasMore ? data[data.length - 1]?.id : null };
  }

  async detail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...userSummary,
        bio: true,
        moderationNote: true,
        postsCount: true,
        followersCount: true,
        followingCount: true,
        _count: {
          select: {
            reviews: true,
            checkins: true,
            reports: true,
            cafesCreated: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateRole(actorId: string, id: string, role: UserRole) {
    await this.assertExists(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: userSummary,
    });
    await this.audit.log(actorId, 'user.role.update', 'user', id, { role });
    return user;
  }

  async updateStatus(actorId: string, id: string, dto: UpdateUserStatusDto) {
    await this.assertExists(id);
    const data: Prisma.UserUpdateInput = {
      status: dto.status,
      moderationNote: dto.note ?? null,
      bannedAt: dto.status === UserStatus.BANNED ? new Date() : null,
      suspendedUntil:
        dto.status === UserStatus.SUSPENDED && dto.suspendedUntil
          ? new Date(dto.suspendedUntil)
          : null,
    };
    if (dto.status === UserStatus.SUSPENDED && !dto.suspendedUntil) {
      throw new BadRequestException('suspendedUntil is required to suspend');
    }
    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: userSummary,
    });
    await this.audit.log(actorId, 'user.status.update', 'user', id, {
      status: dto.status,
      note: dto.note,
    });
    return user;
  }

  async remove(actorId: string, id: string) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot delete a super admin');
    }
    await this.prisma.user.delete({ where: { id } });
    await this.audit.log(actorId, 'user.delete', 'user', id);
    return { deleted: true };
  }

  private async assertExists(id: string) {
    const exists = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('User not found');
  }
}
