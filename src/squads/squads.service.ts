import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { ActivityType, Prisma, SquadCategory, SquadRole } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateSquadDto, SquadMessageDto } from './dto/squad.dto';

const MEMBER_USER_SELECT = {
  select: { id: true, username: true, name: true, avatarUrl: true },
};

@Injectable()
export class SquadsService {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    @Inject(forwardRef(() => RealtimeGateway))
    private realtime: RealtimeGateway,
  ) {}

  private slugify(name: string) {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    return `${base || 'squad'}-${Math.random().toString(36).slice(2, 7)}`;
  }

  async list(params: { cityId?: string; category?: SquadCategory; q?: string; limit?: number }) {
    const { cityId, category, q } = params;
    const where: Prisma.SquadWhereInput = {
      isPublic: true,
      ...(category ? { category } : {}),
      ...(cityId ? { OR: [{ cityId }, { cityId: null }] } : {}),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    };
    return this.prisma.squad.findMany({
      where,
      orderBy: [{ memberCount: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(params.limit ?? 30, 50),
      include: {
        cafe: { select: { id: true, name: true } },
        _count: { select: { members: true, messages: true } },
      },
    });
  }

  async mine(userId: string) {
    const memberships = await this.prisma.squadMember.findMany({
      where: { userId },
      orderBy: { joinedAt: 'desc' },
      include: {
        squad: {
          include: {
            cafe: { select: { id: true, name: true } },
            _count: { select: { members: true } },
          },
        },
      },
    });
    return memberships.map((m) => ({
      ...m.squad,
      myRole: m.role,
      lastReadAt: m.lastReadAt,
    }));
  }

  async get(idOrSlug: string, userId?: string) {
    const squad = await this.prisma.squad.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        cafe: { select: { id: true, name: true, address: true } },
        city: { select: { id: true, name: true } },
        _count: { select: { members: true, messages: true } },
      },
    });
    if (!squad) throw new NotFoundException('Squad not found');

    let myMembership: { role: SquadRole } | null = null;
    if (userId) {
      const m = await this.prisma.squadMember.findUnique({
        where: { squadId_userId: { squadId: squad.id, userId } },
        select: { role: true },
      });
      myMembership = m;
    }
    return { ...squad, isMember: !!myMembership, myRole: myMembership?.role ?? null };
  }

  async create(userId: string, dto: CreateSquadDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { cityId: true, countryId: true },
    });

    let cafeCityId: string | null = null;
    let cafeCountryId: string | null = null;
    if (dto.cafeId) {
      const cafe = await this.prisma.cafe.findUnique({
        where: { id: dto.cafeId },
        select: { cityId: true, countryId: true },
      });
      if (!cafe) throw new NotFoundException('Cafe not found');
      cafeCityId = cafe.cityId;
      cafeCountryId = cafe.countryId;
    }

    const squad = await this.prisma.squad.create({
      data: {
        name: dto.name,
        slug: this.slugify(dto.name),
        description: dto.description,
        category: dto.category,
        cafeId: dto.cafeId,
        cityId: cafeCityId ?? user.cityId,
        countryId: cafeCountryId ?? user.countryId,
        emoji: dto.emoji,
        coverUrl: dto.coverUrl,
        isPublic: dto.isPublic ?? true,
        createdById: userId,
        memberCount: 1,
        members: {
          create: { userId, role: SquadRole.OWNER },
        },
      },
    });

    await this.activity.record({
      actorId: userId,
      type: ActivityType.FRIEND_JOINED_SQUAD,
      squadId: squad.id,
      cityId: squad.cityId,
    });

    return squad;
  }

  async join(userId: string, squadId: string) {
    const squad = await this.prisma.squad.findUnique({ where: { id: squadId } });
    if (!squad) throw new NotFoundException('Squad not found');

    const existing = await this.prisma.squadMember.findUnique({
      where: { squadId_userId: { squadId, userId } },
    });
    if (existing) return existing;

    const [member] = await this.prisma.$transaction([
      this.prisma.squadMember.create({
        data: { squadId, userId, role: SquadRole.MEMBER },
      }),
      this.prisma.squad.update({
        where: { id: squadId },
        data: { memberCount: { increment: 1 } },
      }),
    ]);

    await this.activity.record({
      actorId: userId,
      type: ActivityType.FRIEND_JOINED_SQUAD,
      squadId,
      cityId: squad.cityId,
    });

    this.realtime.emitToSquad(squadId, 'squad:member-joined', { squadId, userId });
    return member;
  }

  async leave(userId: string, squadId: string) {
    const member = await this.prisma.squadMember.findUnique({
      where: { squadId_userId: { squadId, userId } },
    });
    if (!member) throw new BadRequestException('Not a member of this squad');

    await this.prisma.$transaction([
      this.prisma.squadMember.delete({ where: { id: member.id } }),
      this.prisma.squad.update({
        where: { id: squadId },
        data: { memberCount: { decrement: 1 } },
      }),
    ]);
    return { ok: true };
  }

  members(squadId: string) {
    return this.prisma.squadMember.findMany({
      where: { squadId },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      include: { user: MEMBER_USER_SELECT },
    });
  }

  leaderboard(squadId: string) {
    return this.prisma.squadMember.findMany({
      where: { squadId },
      orderBy: { points: 'desc' },
      take: 50,
      include: { user: MEMBER_USER_SELECT },
    });
  }

  private async assertMember(squadId: string, userId: string) {
    const member = await this.prisma.squadMember.findUnique({
      where: { squadId_userId: { squadId, userId } },
    });
    if (!member) throw new ForbiddenException('Join the squad to access the chat');
    return member;
  }

  async messages(userId: string, squadId: string, cursor?: string, limit = 30) {
    await this.assertMember(squadId, userId);
    const items = await this.prisma.squadMessage.findMany({
      where: { squadId },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: { sender: MEMBER_USER_SELECT },
    });
    const hasMore = items.length > limit;
    const data = (hasMore ? items.slice(0, limit) : items).reverse();
    await this.prisma.squadMember.update({
      where: { squadId_userId: { squadId, userId } },
      data: { lastReadAt: new Date() },
    });
    return {
      data,
      nextCursor: hasMore ? items[limit - 1]?.id ?? null : null,
    };
  }

  async sendMessage(userId: string, squadId: string, dto: SquadMessageDto) {
    await this.assertMember(squadId, userId);
    if (!dto.body?.trim() && !dto.imageUrl) {
      throw new BadRequestException('Message cannot be empty');
    }
    const message = await this.prisma.squadMessage.create({
      data: {
        squadId,
        senderId: userId,
        body: dto.body?.trim() || null,
        imageUrl: dto.imageUrl,
      },
      include: { sender: MEMBER_USER_SELECT },
    });

    await this.prisma.squadMember.update({
      where: { squadId_userId: { squadId, userId } },
      data: { points: { increment: 1 } },
    });

    this.realtime.emitToSquad(squadId, 'squad:message', message);
    return message;
  }
}
