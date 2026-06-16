import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CafeOwnershipClaimKind,
  CafePhotoKind,
  CafeRole,
  CafeStaffInviteStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import {
  CreateCafeDto,
  InviteStaffDto,
  UpdateCafeProfileDto,
} from './dto/cafe-os.dto';

const STAFF_USER_SELECT = {
  select: { id: true, username: true, name: true, avatarUrl: true },
};

@Injectable()
export class CafeOsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  // ---------- Cafes ----------

  async createCafe(userId: string, dto: CreateCafeDto) {
    const city = await this.prisma.city.findUnique({
      where: { id: dto.cityId },
    });
    if (!city) throw new NotFoundException('City not found');

    const slug = await this.uniqueSlug(dto.name);
    const cafe = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cafe.create({
        data: {
          name: dto.name,
          slug,
          address: dto.address,
          description: dto.description ?? null,
          logoUrl: dto.logoUrl ?? null,
          lat: dto.lat ?? 0,
          lng: dto.lng ?? 0,
          cityId: city.id,
          countryId: city.countryId,
          createdById: userId,
        },
      });
      await tx.cafeStaff.create({
        data: { userId, cafeId: created.id, role: CafeRole.OWNER },
      });
      // Self-service cafes start unverified and go through admin review.
      await tx.cafeOwnershipClaim.create({
        data: {
          cafeId: created.id,
          userId,
          kind: CafeOwnershipClaimKind.NEW_CAFE,
        },
      });
      return created;
    });

    await this.audit.log({
      cafeId: cafe.id,
      actorId: userId,
      action: 'cafe.created',
      entity: 'cafe',
      entityId: cafe.id,
      meta: { name: cafe.name },
    });
    return cafe;
  }

  async myCafes(userId: string) {
    const rows = await this.prisma.cafeStaff.findMany({
      where: { userId },
      include: {
        cafe: {
          include: {
            photos: { take: 1, orderBy: { order: 'asc' } },
            city: true,
            menu: { select: { slug: true, isPublished: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      role: r.role,
      joinedAt: r.createdAt,
      cafe: r.cafe,
    }));
  }

  async getCafe(cafeId: string) {
    const cafe = await this.prisma.cafe.findUnique({
      where: { id: cafeId },
      include: {
        photos: { orderBy: { order: 'asc' } },
        city: true,
        menu: { select: { id: true, slug: true, isPublished: true, theme: true } },
        _count: { select: { followers: true, checkins: true, reviews: true } },
      },
    });
    if (!cafe) throw new NotFoundException('Cafe not found');
    return cafe;
  }

  async updateCafe(userId: string, cafeId: string, dto: UpdateCafeProfileDto) {
    const { gallery, slug, ...fields } = dto;
    if (!Object.keys(dto).length) {
      throw new BadRequestException('No fields to update');
    }

    if (slug) {
      const taken = await this.prisma.cafe.findUnique({ where: { slug } });
      if (taken && taken.id !== cafeId) {
        throw new BadRequestException('This cafe URL is already taken');
      }
    }

    const cafe = await this.prisma.$transaction(async (tx) => {
      if (gallery) {
        await tx.cafePhoto.deleteMany({
          where: { cafeId, kind: CafePhotoKind.GALLERY },
        });
        if (gallery.length) {
          await tx.cafePhoto.createMany({
            data: gallery.map((url, i) => ({
              cafeId,
              url,
              kind: CafePhotoKind.GALLERY,
              order: i,
            })),
          });
        }
      }
      return tx.cafe.update({
        where: { id: cafeId },
        data: {
          ...fields,
          ...(slug ? { slug } : {}),
          socialLinks: dto.socialLinks as Prisma.InputJsonValue | undefined,
          openingHours: dto.openingHours as Prisma.InputJsonValue | undefined,
        },
        include: { photos: { orderBy: { order: 'asc' } }, city: true },
      });
    });

    await this.audit.log({
      cafeId,
      actorId: userId,
      action: 'cafe.updated',
      entity: 'cafe',
      entityId: cafeId,
      meta: { fields: Object.keys(dto) },
    });
    return cafe;
  }

  // ---------- Staff ----------

  async listStaff(cafeId: string) {
    const [staff, invites] = await Promise.all([
      this.prisma.cafeStaff.findMany({
        where: { cafeId },
        include: { user: STAFF_USER_SELECT },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.cafeStaffInvite.findMany({
        where: { cafeId, status: CafeStaffInviteStatus.PENDING },
        include: { invitee: STAFF_USER_SELECT, inviter: STAFF_USER_SELECT },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { staff, pendingInvites: invites };
  }

  async inviteStaff(inviterId: string, cafeId: string, dto: InviteStaffDto) {
    if (dto.role === CafeRole.OWNER) {
      const inviter = await this.requireStaff(inviterId, cafeId);
      if (inviter.role !== CafeRole.OWNER) {
        throw new ForbiddenException('Only owners can invite other owners');
      }
    }
    const invitee = await this.prisma.user.findUnique({
      where: { username: dto.username.toLowerCase().replace(/^@/, '') },
    });
    if (!invitee) throw new NotFoundException('User not found');
    if (invitee.id === inviterId) {
      throw new BadRequestException('You are already a member');
    }

    const existingStaff = await this.prisma.cafeStaff.findUnique({
      where: { userId_cafeId: { userId: invitee.id, cafeId } },
    });
    if (existingStaff) {
      throw new BadRequestException('User is already a staff member');
    }
    const existingInvite = await this.prisma.cafeStaffInvite.findFirst({
      where: {
        cafeId,
        inviteeId: invitee.id,
        status: CafeStaffInviteStatus.PENDING,
      },
    });
    if (existingInvite) {
      throw new BadRequestException('Invite already pending');
    }

    const cafe = await this.prisma.cafe.findUniqueOrThrow({
      where: { id: cafeId },
      select: { name: true },
    });
    const invite = await this.prisma.cafeStaffInvite.create({
      data: { cafeId, inviterId, inviteeId: invitee.id, role: dto.role },
      include: { invitee: STAFF_USER_SELECT },
    });

    await this.notifications.create({
      userId: invitee.id,
      type: NotificationType.CAFE_STAFF_INVITE,
      actorId: inviterId,
      entityType: 'cafeStaffInvite',
      entityId: invite.id,
      payload: { cafeId, cafeName: cafe.name, role: dto.role },
    });
    await this.audit.log({
      cafeId,
      actorId: inviterId,
      action: 'staff.invited',
      entity: 'staffInvite',
      entityId: invite.id,
      meta: { username: dto.username, role: dto.role },
    });
    return invite;
  }

  async myInvites(userId: string) {
    return this.prisma.cafeStaffInvite.findMany({
      where: { inviteeId: userId, status: CafeStaffInviteStatus.PENDING },
      include: {
        cafe: { select: { id: true, name: true, logoUrl: true, address: true } },
        inviter: STAFF_USER_SELECT,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async respondInvite(userId: string, inviteId: string, accept: boolean) {
    const invite = await this.prisma.cafeStaffInvite.findUnique({
      where: { id: inviteId },
    });
    if (!invite || invite.inviteeId !== userId) {
      throw new NotFoundException('Invite not found');
    }
    if (invite.status !== CafeStaffInviteStatus.PENDING) {
      throw new BadRequestException('Invite already handled');
    }

    if (!accept) {
      return this.prisma.cafeStaffInvite.update({
        where: { id: inviteId },
        data: {
          status: CafeStaffInviteStatus.DECLINED,
          respondedAt: new Date(),
        },
      });
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.cafeStaff.upsert({
        where: { userId_cafeId: { userId, cafeId: invite.cafeId } },
        create: { userId, cafeId: invite.cafeId, role: invite.role },
        update: { role: invite.role },
      }),
      this.prisma.cafeStaffInvite.update({
        where: { id: inviteId },
        data: {
          status: CafeStaffInviteStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      }),
    ]);

    await this.audit.log({
      cafeId: invite.cafeId,
      actorId: userId,
      action: 'staff.joined',
      entity: 'staff',
      meta: { role: invite.role },
    });
    return updated;
  }

  async cancelInvite(actorId: string, cafeId: string, inviteId: string) {
    const invite = await this.prisma.cafeStaffInvite.findUnique({
      where: { id: inviteId },
    });
    if (!invite || invite.cafeId !== cafeId) {
      throw new NotFoundException('Invite not found');
    }
    return this.prisma.cafeStaffInvite.update({
      where: { id: inviteId },
      data: {
        status: CafeStaffInviteStatus.CANCELLED,
        respondedAt: new Date(),
      },
    });
  }

  async updateStaffRole(
    actorId: string,
    cafeId: string,
    staffId: string,
    role: CafeRole,
  ) {
    const target = await this.prisma.cafeStaff.findUnique({
      where: { id: staffId },
      include: { user: STAFF_USER_SELECT },
    });
    if (!target || target.cafeId !== cafeId) {
      throw new NotFoundException('Staff member not found');
    }
    if (target.userId === actorId) {
      throw new BadRequestException('You cannot change your own role');
    }
    await this.assertNotLastOwner(cafeId, target, role);

    const updated = await this.prisma.cafeStaff.update({
      where: { id: staffId },
      data: { role },
      include: { user: STAFF_USER_SELECT },
    });
    await this.audit.log({
      cafeId,
      actorId,
      action: 'staff.role_changed',
      entity: 'staff',
      entityId: staffId,
      meta: { username: target.user.username, from: target.role, to: role },
    });
    return updated;
  }

  async removeStaff(actorId: string, cafeId: string, staffId: string) {
    const target = await this.prisma.cafeStaff.findUnique({
      where: { id: staffId },
      include: { user: STAFF_USER_SELECT },
    });
    if (!target || target.cafeId !== cafeId) {
      throw new NotFoundException('Staff member not found');
    }
    await this.assertNotLastOwner(cafeId, target, null);

    await this.prisma.cafeStaff.delete({ where: { id: staffId } });
    await this.audit.log({
      cafeId,
      actorId,
      action: 'staff.removed',
      entity: 'staff',
      entityId: staffId,
      meta: { username: target.user.username, role: target.role },
    });
    return { removed: true };
  }

  // ---------- Helpers ----------

  async requireStaff(userId: string, cafeId: string) {
    const staff = await this.prisma.cafeStaff.findUnique({
      where: { userId_cafeId: { userId, cafeId } },
    });
    if (!staff) throw new ForbiddenException('Not a member of this cafe');
    return staff;
  }

  private async assertNotLastOwner(
    cafeId: string,
    target: { role: CafeRole },
    newRole: CafeRole | null,
  ) {
    if (target.role !== CafeRole.OWNER || newRole === CafeRole.OWNER) return;
    const owners = await this.prisma.cafeStaff.count({
      where: { cafeId, role: CafeRole.OWNER },
    });
    if (owners <= 1) {
      throw new BadRequestException('A cafe must keep at least one owner');
    }
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
}
