import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BugAttachmentKind, BugStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BugTriageService } from './bug-triage.service';
import { CreateBugReportDto } from './dto/create-bug-report.dto';
import { ListBugReportsDto } from './dto/list-bug-reports.dto';
import { UpdateBugReportDto } from './dto/update-bug-report.dto';
import { AddBugCommentDto } from './dto/add-comment.dto';
import { scrubPii } from './pii.util';

const PAGE_SIZE = 30;
const TICKET_SEQ_KEY = 'bug:ticket:seq';
const TICKET_BASE = 100000;
const DUP_WINDOW_DAYS = 30;
const IDEMPOTENCY_TTL = 60 * 60; // 1h

/** Fields safe to return to the reporter (their own ticket). */
const REPORTER_SELECT = {
  id: true,
  ticketNumber: true,
  title: true,
  description: true,
  category: true,
  status: true,
  severity: true,
  route: true,
  screenshotUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BugReportSelect;

@Injectable()
export class BugReportsService {
  private readonly logger = new Logger(BugReportsService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private triage: BugTriageService,
  ) {}

  // --- user-facing ------------------------------------------------------------

  async create(userId: string, dto: CreateBugReportDto) {
    // Idempotency: an offline-queue retry with the same clientToken returns the
    // ticket created on the first successful submit instead of duplicating it.
    const idemKey = dto.clientToken
      ? `bug:idem:${userId}:${dto.clientToken}`
      : null;
    if (idemKey) {
      const existingId = await this.redis.client.get(idemKey);
      if (existingId) {
        const existing = await this.prisma.bugReport.findUnique({
          where: { id: existingId },
          select: REPORTER_SELECT,
        });
        if (existing) return existing;
      }
    }

    const title = (scrubPii(dto.title.trim()) as string) ?? dto.title.trim();
    const description =
      (scrubPii(dto.description.trim()) as string) ?? dto.description.trim();
    const fingerprint = this.triage.fingerprint(dto.title, dto.category);
    const duplicateOfId = await this.findDuplicate(fingerprint);

    const report = await this.createWithUniqueTicket({
      userId,
      title,
      description,
      category: dto.category,
      route: dto.route,
      screenshotUrl: dto.screenshotUrl,
      replayUrl: dto.replayUrl,
      deviceInfo: this.scrubJson(dto.deviceInfo),
      appInfo: this.scrubJson(dto.appInfo),
      metadata: this.scrubJson(dto.metadata),
      logs: this.scrubJson(dto.logs),
      fingerprint,
      duplicateOfId,
      attachments: dto.attachments,
    });

    if (idemKey) {
      await this.redis.client.set(idemKey, report.id, 'EX', IDEMPOTENCY_TTL);
    }

    // Triage runs asynchronously so the client gets an instant ticket number.
    void this.runTriage(report.id);

    return {
      id: report.id,
      ticketNumber: report.ticketNumber,
      status: report.status,
      createdAt: report.createdAt,
    };
  }

  listMine(userId: string, cursor?: string) {
    return this.paginate({ userId }, cursor, REPORTER_SELECT);
  }

  async getMine(userId: string, id: string) {
    const report = await this.prisma.bugReport.findUnique({
      where: { id },
      select: { ...REPORTER_SELECT, userId: true },
    });
    if (!report) throw new NotFoundException('Report not found');
    const { userId: ownerId, ...rest } = report;
    if (ownerId !== userId) throw new NotFoundException('Report not found');
    return rest;
  }

  // --- admin / support --------------------------------------------------------

  async adminList(filters: ListBugReportsDto) {
    const where: Prisma.BugReportWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.category) where.category = filters.category;
    if (filters.severity) where.severity = filters.severity;
    if (filters.appVersion) {
      where.appInfo = { path: ['appVersion'], equals: filters.appVersion };
    }
    if (filters.device) {
      where.deviceInfo = { path: ['model'], equals: filters.device };
    }
    if (filters.assignee) {
      where.assigneeId =
        filters.assignee === 'unassigned' ? null : filters.assignee;
    }
    if (filters.q) {
      where.OR = [
        { ticketNumber: { contains: filters.q, mode: 'insensitive' } },
        { title: { contains: filters.q, mode: 'insensitive' } },
        { description: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    return this.paginate(where, filters.cursor, {
      id: true,
      ticketNumber: true,
      title: true,
      category: true,
      status: true,
      severity: true,
      aiSeverity: true,
      aiSummary: true,
      route: true,
      fixVersion: true,
      duplicateOfId: true,
      createdAt: true,
      user: { select: { id: true, username: true } },
      assignee: { select: { id: true, username: true } },
      _count: { select: { duplicates: true, comments: true } },
    });
  }

  async adminGet(id: string) {
    const report = await this.prisma.bugReport.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, name: true } },
        assignee: { select: { id: true, username: true } },
        attachments: { orderBy: { createdAt: 'asc' } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, username: true } } },
        },
        duplicateOf: { select: { id: true, ticketNumber: true, title: true } },
        _count: { select: { duplicates: true } },
      },
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async adminUpdate(id: string, dto: UpdateBugReportDto) {
    await this.assertExists(id);
    if (dto.duplicateOfId && dto.duplicateOfId === id) {
      throw new ForbiddenException('A report cannot be a duplicate of itself');
    }

    const data: Prisma.BugReportUpdateInput = {};
    if (dto.severity !== undefined) data.severity = dto.severity;
    if (dto.fixVersion !== undefined) data.fixVersion = dto.fixVersion;
    if (dto.status !== undefined) {
      data.status = dto.status;
      data.resolvedAt =
        dto.status === BugStatus.FIXED || dto.status === BugStatus.CLOSED
          ? new Date()
          : null;
    }
    if (dto.assigneeId !== undefined) {
      data.assignee = dto.assigneeId
        ? { connect: { id: dto.assigneeId } }
        : { disconnect: true };
    }
    if (dto.duplicateOfId !== undefined) {
      data.duplicateOf = dto.duplicateOfId
        ? { connect: { id: dto.duplicateOfId } }
        : { disconnect: true };
    }

    return this.prisma.bugReport.update({ where: { id }, data });
  }

  async addComment(reportId: string, authorId: string, dto: AddBugCommentDto) {
    await this.assertExists(reportId);
    return this.prisma.bugReportComment.create({
      data: {
        reportId,
        authorId,
        body: dto.body.trim(),
        internal: dto.internal ?? true,
      },
      include: { author: { select: { id: true, username: true } } },
    });
  }

  /** Duplicate clusters: ticket -> count of reports sharing its fingerprint. */
  async adminDuplicates(id: string) {
    const report = await this.assertExists(id);
    if (!report.fingerprint) return { fingerprint: null, related: [] };
    const related = await this.prisma.bugReport.findMany({
      where: { fingerprint: report.fingerprint, id: { not: id } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        status: true,
        severity: true,
        createdAt: true,
      },
    });
    return { fingerprint: report.fingerprint, related };
  }

  // --- internals --------------------------------------------------------------

  private async runTriage(id: string) {
    try {
      const report = await this.prisma.bugReport.findUnique({
        where: { id },
        select: {
          title: true,
          description: true,
          category: true,
          route: true,
          logs: true,
          deviceInfo: true,
          appInfo: true,
        },
      });
      if (!report) return;
      const result = await this.triage.triage(report);
      await this.prisma.bugReport.update({
        where: { id },
        data: {
          aiSummary: result.summary,
          aiProbableCause: result.probableCause,
          aiSeverity: result.severity,
          aiReproSteps: result.reproSteps,
          // Adopt the AI's severity suggestion as the working severity only
          // while the report is still untouched (OPEN, default MEDIUM).
          severity: result.severity,
          triagedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(
        `Triage failed for report ${id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async findDuplicate(fingerprint: string): Promise<string | null> {
    const since = new Date(Date.now() - DUP_WINDOW_DAYS * 86_400_000);
    const original = await this.prisma.bugReport.findFirst({
      where: {
        fingerprint,
        duplicateOfId: null,
        status: { not: BugStatus.CLOSED },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return original?.id ?? null;
  }

  private async createWithUniqueTicket(args: {
    userId: string;
    title: string;
    description: string;
    category: CreateBugReportDto['category'];
    route?: string;
    screenshotUrl?: string;
    replayUrl?: string;
    deviceInfo: Prisma.InputJsonValue | undefined;
    appInfo: Prisma.InputJsonValue | undefined;
    metadata: Prisma.InputJsonValue | undefined;
    logs: Prisma.InputJsonValue | undefined;
    fingerprint: string;
    duplicateOfId: string | null;
    attachments?: CreateBugReportDto['attachments'];
  }) {
    const attachments = (args.attachments ?? []).slice(0, 20).map((a) => ({
      kind: a.kind as BugAttachmentKind,
      url: a.url,
      mimeType: a.mimeType,
      meta: this.scrubJson(a.meta),
    }));

    // Retry on the (extremely unlikely) ticket-number collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const seq = await this.redis.client.incr(TICKET_SEQ_KEY);
      const ticketNumber = String(TICKET_BASE + seq);
      try {
        return await this.prisma.bugReport.create({
          data: {
            ticketNumber,
            userId: args.userId,
            title: args.title,
            description: args.description,
            category: args.category,
            route: args.route,
            screenshotUrl: args.screenshotUrl,
            replayUrl: args.replayUrl,
            deviceInfo: args.deviceInfo,
            appInfo: args.appInfo,
            metadata: args.metadata,
            logs: args.logs,
            fingerprint: args.fingerprint,
            duplicateOfId: args.duplicateOfId,
            ...(attachments.length
              ? { attachments: { create: attachments } }
              : {}),
          },
          select: {
            id: true,
            ticketNumber: true,
            status: true,
            createdAt: true,
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          continue; // ticketNumber raced — try the next sequence value
        }
        throw err;
      }
    }
    throw new Error('Could not allocate a unique ticket number');
  }

  private async assertExists(id: string) {
    const report = await this.prisma.bugReport.findUnique({
      where: { id },
      select: { id: true, fingerprint: true },
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  private scrubJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value == null) return undefined;
    return scrubPii(value) as Prisma.InputJsonValue;
  }

  private async paginate(
    where: Prisma.BugReportWhereInput,
    cursor: string | undefined,
    select: Prisma.BugReportSelect,
  ) {
    const items = await this.prisma.bugReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select,
    });
    const hasMore = items.length > PAGE_SIZE;
    const data = hasMore ? items.slice(0, PAGE_SIZE) : items;
    return {
      data,
      nextCursor: hasMore ? (data[data.length - 1] as { id: string }).id : null,
    };
  }
}
