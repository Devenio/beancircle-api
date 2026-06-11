import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LoyaltyProgramKind, NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import { UpsertLoyaltyProgramDto } from './dto/cafe-os.dto';

const PROGRESS_KINDS: LoyaltyProgramKind[] = [
  LoyaltyProgramKind.STAMP_CARD,
  LoyaltyProgramKind.VISIT_COUNT,
];

@Injectable()
export class LoyaltyService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private audit: AuditService,
  ) {}

  // ---------- Owner side ----------

  listPrograms(cafeId: string) {
    return this.prisma.loyaltyProgram.findMany({
      where: { cafeId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { progress: true } },
      },
    });
  }

  async createProgram(
    actorId: string,
    cafeId: string,
    dto: UpsertLoyaltyProgramDto,
  ) {
    const program = await this.prisma.loyaltyProgram.create({
      data: { cafeId, ...dto },
    });
    await this.audit.log({
      cafeId,
      actorId,
      action: 'loyalty.program_created',
      entity: 'loyaltyProgram',
      entityId: program.id,
      meta: { title: dto.title, kind: dto.kind },
    });
    return program;
  }

  async updateProgram(
    actorId: string,
    cafeId: string,
    programId: string,
    dto: Partial<UpsertLoyaltyProgramDto>,
  ) {
    await this.requireProgram(cafeId, programId);
    const program = await this.prisma.loyaltyProgram.update({
      where: { id: programId },
      data: dto,
    });
    await this.audit.log({
      cafeId,
      actorId,
      action: 'loyalty.program_updated',
      entity: 'loyaltyProgram',
      entityId: programId,
      meta: { fields: Object.keys(dto) },
    });
    return program;
  }

  async deleteProgram(actorId: string, cafeId: string, programId: string) {
    await this.requireProgram(cafeId, programId);
    await this.prisma.loyaltyProgram.delete({ where: { id: programId } });
    await this.audit.log({
      cafeId,
      actorId,
      action: 'loyalty.program_deleted',
      entity: 'loyaltyProgram',
      entityId: programId,
    });
    return { deleted: true };
  }

  /** Members who completed a program and are waiting to redeem, plus leaders. */
  async programProgress(cafeId: string, programId: string) {
    const program = await this.requireProgram(cafeId, programId);
    const rows = await this.prisma.loyaltyCardProgress.findMany({
      where: { programId },
      orderBy: [{ completedAt: 'desc' }, { progress: 'desc' }],
      take: 100,
      include: {
        user: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
    });
    return { program, progress: rows };
  }

  /** Staff confirms an in-person redemption; the card resets for a new cycle. */
  async redeem(
    actorId: string,
    cafeId: string,
    programId: string,
    userId: string,
  ) {
    const program = await this.requireProgram(cafeId, programId);
    const row = await this.prisma.loyaltyCardProgress.findUnique({
      where: { programId_userId: { programId, userId } },
    });
    if (!row?.completedAt) {
      throw new BadRequestException('Customer has not completed this card yet');
    }

    // Redeeming resets the card for a new cycle; redeemedAt keeps the last
    // redemption timestamp for the timeline.
    const updated = await this.prisma.loyaltyCardProgress.update({
      where: { id: row.id },
      data: { progress: 0, completedAt: null, redeemedAt: new Date() },
    });
    await this.audit.log({
      cafeId,
      actorId,
      action: 'loyalty.redeemed',
      entity: 'loyaltyProgram',
      entityId: programId,
      meta: { userId, reward: program.rewardLabel },
    });
    await this.notifications.create({
      userId,
      type: NotificationType.LOYALTY_REWARD,
      actorId,
      entityType: 'loyaltyProgram',
      entityId: programId,
      payload: {
        cafeId,
        redeemed: true,
        title: program.title,
        reward: program.rewardLabel,
      },
    });
    return updated;
  }

  // ---------- Hooks ----------

  /** Advance all active progress-based programs after a confirmed visit. */
  async onVisit(cafeId: string, userId: string) {
    const programs = await this.prisma.loyaltyProgram.findMany({
      where: { cafeId, isActive: true, kind: { in: PROGRESS_KINDS } },
    });
    const completed: { programId: string; title: string; reward: string }[] = [];

    for (const program of programs) {
      const row = await this.prisma.loyaltyCardProgress.upsert({
        where: { programId_userId: { programId: program.id, userId } },
        create: { programId: program.id, userId, progress: 1 },
        update: { progress: { increment: 1 } },
      });
      if (!row.completedAt && row.progress >= program.goal) {
        await this.prisma.loyaltyCardProgress.update({
          where: { id: row.id },
          data: { completedAt: new Date(), progress: program.goal },
        });
        completed.push({
          programId: program.id,
          title: program.title,
          reward: program.rewardLabel,
        });
      }
    }

    for (const c of completed) {
      await this.notifications.create({
        userId,
        type: NotificationType.LOYALTY_REWARD,
        entityType: 'loyaltyProgram',
        entityId: c.programId,
        payload: { cafeId, title: c.title, reward: c.reward },
      });
    }
    return completed;
  }

  // ---------- Consumer side ----------

  /** All of a user's loyalty cards across cafes — shown in the passport. */
  async myCards(userId: string) {
    const rows = await this.prisma.loyaltyCardProgress.findMany({
      where: { userId, program: { isActive: true } },
      orderBy: { updatedAt: 'desc' },
      include: {
        program: {
          include: {
            cafe: { select: { id: true, name: true, logoUrl: true, slug: true } },
          },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      progress: row.progress,
      completedAt: row.completedAt,
      redeemedAt: row.redeemedAt,
      program: {
        id: row.program.id,
        kind: row.program.kind,
        title: row.program.title,
        goal: row.program.goal,
        rewardLabel: row.program.rewardLabel,
      },
      cafe: row.program.cafe,
    }));
  }

  async consumerView(cafeId: string, userId: string) {
    const [programs, user] = await Promise.all([
      this.prisma.loyaltyProgram.findMany({
        where: { cafeId, isActive: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { dateOfBirth: true },
      }),
    ]);
    const progress = await this.prisma.loyaltyCardProgress.findMany({
      where: { userId, programId: { in: programs.map((p) => p.id) } },
    });
    const customer = await this.prisma.cafeCustomer.findUnique({
      where: { cafeId_userId: { cafeId, userId } },
      select: { isVip: true, visitCount: true },
    });

    const byProgram = new Map(progress.map((p) => [p.programId, p]));
    const month = new Date().getMonth();
    return programs.map((p) => {
      const mine = byProgram.get(p.id);
      let state: Record<string, unknown> = {
        progress: mine?.progress ?? 0,
        completed: !!mine?.completedAt,
      };
      if (p.kind === LoyaltyProgramKind.BIRTHDAY) {
        state = {
          eligible:
            user?.dateOfBirth != null &&
            new Date(user.dateOfBirth).getMonth() === month,
        };
      }
      if (p.kind === LoyaltyProgramKind.VIP) {
        state = { eligible: customer?.isVip ?? false };
      }
      return { ...p, my: state };
    });
  }

  private async requireProgram(cafeId: string, programId: string) {
    const program = await this.prisma.loyaltyProgram.findUnique({
      where: { id: programId },
    });
    if (!program || program.cafeId !== cafeId) {
      throw new NotFoundException('Loyalty program not found');
    }
    return program;
  }
}
