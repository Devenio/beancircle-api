import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BeanReactionType,
  BeanScoreAction,
  BeanType,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { BeanScoreService } from '../beanscore/beanscore.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const HASHTAG_RE = /#([\p{L}\p{N}_]+)/gu;
const MENTION_RE = /@([a-zA-Z0-9_.]+)/g;
const TRENDING_WINDOW_HOURS = 72;
const POPULAR_REACTION_THRESHOLD = 10;

export interface CreateBeanInput {
  type?: BeanType;
  body?: string;
  cafeId?: string;
  eventId?: string;
  squadId?: string;
  locationLabel?: string;
  lat?: number;
  lng?: number;
  linkUrl?: string;
  parentId?: string;
  quotedBeanId?: string;
  media?: { type?: 'IMAGE' | 'VIDEO' | 'GIF'; url: string }[];
  poll?: { options: string[]; endsAt?: string };
}

@Injectable()
export class BeansService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private beanScore: BeanScoreService,
  ) {}

  // ===== Create / delete =====

  async create(authorId: string, input: CreateBeanInput) {
    const body = input.body?.trim() || undefined;
    const hasMedia = !!input.media?.length;
    const hasPoll = !!input.poll?.options?.length;
    if (!body && !hasMedia && !hasPoll) {
      throw new BadRequestException('A Bean needs text, media or a poll');
    }
    if (hasPoll) {
      const options = input.poll!.options.map((o) => o.trim()).filter(Boolean);
      if (options.length < 2 || options.length > 4) {
        throw new BadRequestException('A poll needs 2 to 4 options');
      }
      input.poll = { ...input.poll!, options };
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: authorId },
    });

    let parent: { id: string; authorId: string; rootId: string | null } | null =
      null;
    if (input.parentId) {
      parent = await this.prisma.bean.findUnique({
        where: { id: input.parentId },
        select: { id: true, authorId: true, rootId: true },
      });
      if (!parent) throw new NotFoundException('Bean not found');
    }

    let quoted: { id: string; authorId: string } | null = null;
    if (input.quotedBeanId) {
      quoted = await this.prisma.bean.findUnique({
        where: { id: input.quotedBeanId },
        select: { id: true, authorId: true },
      });
      if (!quoted) throw new NotFoundException('Quoted Bean not found');
    }

    const type = input.type ?? this.inferType(input);
    const tags = this.extractHashtags(body);
    const mentionedUsers = await this.resolveMentions(body, authorId);

    const bean = await this.prisma.$transaction(async (tx) => {
      const created = await tx.bean.create({
        data: {
          authorId,
          type,
          body,
          cafeId: input.cafeId,
          eventId: input.eventId,
          squadId: input.squadId,
          locationLabel: input.locationLabel,
          lat: input.lat,
          lng: input.lng,
          linkUrl: input.linkUrl,
          parentId: parent?.id,
          rootId: parent ? (parent.rootId ?? parent.id) : undefined,
          quotedBeanId: quoted?.id,
          cityId: user.cityId ?? undefined,
          countryId: user.countryId ?? undefined,
          media: hasMedia
            ? {
                create: input.media!.map((m, order) => ({
                  type: m.type ?? 'IMAGE',
                  url: m.url,
                  order,
                })),
              }
            : undefined,
          poll: hasPoll
            ? {
                create: {
                  endsAt: input.poll!.endsAt
                    ? new Date(input.poll!.endsAt)
                    : undefined,
                  options: {
                    create: input.poll!.options.map((label, order) => ({
                      label,
                      order,
                    })),
                  },
                },
              }
            : undefined,
          mentions: mentionedUsers.length
            ? { create: mentionedUsers.map((u) => ({ userId: u.id })) }
            : undefined,
        },
        include: this.beanInclude(authorId),
      });

      for (const tag of tags) {
        const hashtag = await tx.hashtag.upsert({
          where: { tag },
          create: { tag, beanCount: 1 },
          update: { beanCount: { increment: 1 } },
        });
        await tx.beanHashtag.create({
          data: { beanId: created.id, hashtagId: hashtag.id },
        });
      }

      if (parent) {
        await tx.bean.update({
          where: { id: parent.id },
          data: { replyCount: { increment: 1 } },
        });
      }
      if (quoted) {
        await tx.bean.update({
          where: { id: quoted.id },
          data: { quoteCount: { increment: 1 } },
        });
      }
      if (!parent) {
        await tx.user.update({
          where: { id: authorId },
          data: { postsCount: { increment: 1 } },
        });
      }
      return created;
    });

    await this.beanScore.award(
      authorId,
      parent ? BeanScoreAction.BEAN_REPLY : BeanScoreAction.BEAN,
      bean.id,
    );
    if (hasMedia) {
      await this.beanScore.award(authorId, BeanScoreAction.BEAN_MEDIA, bean.id);
    }

    if (parent && parent.authorId !== authorId) {
      await this.notifications.create({
        userId: parent.authorId,
        type: NotificationType.BEAN_REPLY,
        actorId: authorId,
        entityType: 'bean',
        entityId: parent.id,
      });
    }
    if (quoted && quoted.authorId !== authorId) {
      await this.notifications.create({
        userId: quoted.authorId,
        type: NotificationType.BEAN_QUOTE,
        actorId: authorId,
        entityType: 'bean',
        entityId: bean.id,
      });
    }
    for (const mentioned of mentionedUsers) {
      if (mentioned.id === authorId) continue;
      await this.notifications.create({
        userId: mentioned.id,
        type: NotificationType.BEAN_MENTION,
        actorId: authorId,
        entityType: 'bean',
        entityId: bean.id,
      });
    }

    return this.decorate(bean);
  }

  async delete(userId: string, beanId: string) {
    const bean = await this.prisma.bean.findUnique({
      where: { id: beanId },
      include: { hashtags: true },
    });
    if (!bean) throw new NotFoundException('Bean not found');
    if (bean.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own Beans');
    }
    await this.prisma.$transaction(async (tx) => {
      if (bean.parentId) {
        await tx.bean.updateMany({
          where: { id: bean.parentId },
          data: { replyCount: { decrement: 1 } },
        });
      }
      if (bean.quotedBeanId) {
        await tx.bean.updateMany({
          where: { id: bean.quotedBeanId },
          data: { quoteCount: { decrement: 1 } },
        });
      }
      if (bean.rebeanOfId) {
        await tx.bean.updateMany({
          where: { id: bean.rebeanOfId },
          data: { rebeanCount: { decrement: 1 } },
        });
      }
      if (bean.hashtags.length) {
        await tx.hashtag.updateMany({
          where: { id: { in: bean.hashtags.map((h) => h.hashtagId) } },
          data: { beanCount: { decrement: 1 } },
        });
      }
      if (!bean.parentId) {
        await tx.user.updateMany({
          where: { id: userId, postsCount: { gt: 0 } },
          data: { postsCount: { decrement: 1 } },
        });
      }
      await tx.bean.delete({ where: { id: beanId } });
    });
    return { deleted: true };
  }

  // ===== ReBean =====

  async rebean(userId: string, beanId: string) {
    const original = await this.prisma.bean.findUnique({
      where: { id: beanId },
      select: { id: true, authorId: true, type: true, rebeanOfId: true },
    });
    if (!original) throw new NotFoundException('Bean not found');
    if (original.rebeanOfId) {
      throw new BadRequestException('ReBean the original Bean instead');
    }
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const r = await tx.bean.create({
          data: {
            authorId: userId,
            type: original.type,
            rebeanOfId: original.id,
          },
          include: this.beanInclude(userId),
        });
        await tx.bean.update({
          where: { id: original.id },
          data: { rebeanCount: { increment: 1 } },
        });
        return r;
      });
      if (original.authorId !== userId) {
        await this.notifications.create({
          userId: original.authorId,
          type: NotificationType.BEAN_REBEAN,
          actorId: userId,
          entityType: 'bean',
          entityId: original.id,
        });
        await this.beanScore.award(
          original.authorId,
          BeanScoreAction.BEAN_REBEAN_RECEIVED,
          created.id,
        );
      }
      return this.decorate(created);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException('Already ReBeaned');
      }
      throw e;
    }
  }

  async unrebean(userId: string, beanId: string) {
    const existing = await this.prisma.bean.findFirst({
      where: { authorId: userId, rebeanOfId: beanId },
      select: { id: true },
    });
    if (!existing) return { rebeaned: false };
    await this.prisma.$transaction([
      this.prisma.bean.delete({ where: { id: existing.id } }),
      this.prisma.bean.update({
        where: { id: beanId },
        data: { rebeanCount: { decrement: 1 } },
      }),
    ]);
    return { rebeaned: false };
  }

  // ===== Reactions =====

  async react(userId: string, beanId: string, type: BeanReactionType) {
    const bean = await this.prisma.bean.findUnique({
      where: { id: beanId },
      select: { id: true, authorId: true, reactionCount: true },
    });
    if (!bean) throw new NotFoundException('Bean not found');

    const existing = await this.prisma.beanReaction.findUnique({
      where: { beanId_userId: { beanId, userId } },
    });
    if (existing) {
      if (existing.type !== type) {
        await this.prisma.beanReaction.update({
          where: { id: existing.id },
          data: { type },
        });
      }
      return { reaction: type };
    }

    await this.prisma.$transaction([
      this.prisma.beanReaction.create({ data: { beanId, userId, type } }),
      this.prisma.bean.update({
        where: { id: beanId },
        data: { reactionCount: { increment: 1 } },
      }),
    ]);

    if (bean.authorId !== userId) {
      await this.notifications.create({
        userId: bean.authorId,
        type: NotificationType.BEAN_REACTION,
        actorId: userId,
        entityType: 'bean',
        entityId: beanId,
        payload: { reaction: type },
      });
      await this.beanScore.award(
        bean.authorId,
        BeanScoreAction.BEAN_REACTION_RECEIVED,
        beanId,
      );
      if (bean.reactionCount + 1 >= POPULAR_REACTION_THRESHOLD) {
        await this.beanScore.award(
          bean.authorId,
          BeanScoreAction.BEAN_POPULAR,
          beanId,
        );
      }
    }
    return { reaction: type };
  }

  async unreact(userId: string, beanId: string) {
    const existing = await this.prisma.beanReaction.findUnique({
      where: { beanId_userId: { beanId, userId } },
    });
    if (!existing) return { reaction: null };
    await this.prisma.$transaction([
      this.prisma.beanReaction.delete({ where: { id: existing.id } }),
      this.prisma.bean.update({
        where: { id: beanId },
        data: { reactionCount: { decrement: 1 } },
      }),
    ]);
    return { reaction: null };
  }

  // ===== Polls =====

  async votePoll(userId: string, beanId: string, optionId: string) {
    const poll = await this.prisma.beanPoll.findUnique({
      where: { beanId },
      include: { options: true },
    });
    if (!poll) throw new NotFoundException('This Bean has no poll');
    if (poll.endsAt && poll.endsAt < new Date()) {
      throw new BadRequestException('This poll has ended');
    }
    const option = poll.options.find((o) => o.id === optionId);
    if (!option) throw new BadRequestException('Invalid poll option');

    const existing = await this.prisma.beanPollVote.findUnique({
      where: { pollId_userId: { pollId: poll.id, userId } },
    });
    if (existing) {
      if (existing.optionId === optionId) return this.pollResults(poll.id, userId);
      await this.prisma.$transaction([
        this.prisma.beanPollVote.update({
          where: { id: existing.id },
          data: { optionId },
        }),
        this.prisma.beanPollOption.update({
          where: { id: existing.optionId },
          data: { voteCount: { decrement: 1 } },
        }),
        this.prisma.beanPollOption.update({
          where: { id: optionId },
          data: { voteCount: { increment: 1 } },
        }),
      ]);
    } else {
      await this.prisma.$transaction([
        this.prisma.beanPollVote.create({
          data: { pollId: poll.id, optionId, userId },
        }),
        this.prisma.beanPollOption.update({
          where: { id: optionId },
          data: { voteCount: { increment: 1 } },
        }),
      ]);
    }
    return this.pollResults(poll.id, userId);
  }

  private async pollResults(pollId: string, userId: string) {
    const poll = await this.prisma.beanPoll.findUniqueOrThrow({
      where: { id: pollId },
      include: {
        options: { orderBy: { order: 'asc' } },
        votes: { where: { userId }, take: 1 },
      },
    });
    return {
      id: poll.id,
      endsAt: poll.endsAt,
      options: poll.options,
      myOptionId: poll.votes[0]?.optionId ?? null,
      totalVotes: poll.options.reduce((s, o) => s + o.voteCount, 0),
    };
  }

  // ===== Feeds =====

  async getHomeFeed(userId: string, cursor?: string, limit = 20) {
    const [following, cafeFollows, squadMemberships] = await Promise.all([
      this.prisma.userFollow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      }),
      this.prisma.cafeFollow.findMany({
        where: { userId },
        select: { cafeId: true },
      }),
      this.prisma.squadMember.findMany({
        where: { userId },
        select: { squadId: true },
      }),
    ]);
    const authorIds = [...following.map((f) => f.followingId), userId];
    const cafeIds = cafeFollows.map((f) => f.cafeId);
    const squadIds = squadMemberships.map((m) => m.squadId);

    return this.listBeans(
      {
        parentId: null,
        OR: [
          { authorId: { in: authorIds } },
          ...(cafeIds.length ? [{ cafeId: { in: cafeIds } }] : []),
          ...(squadIds.length ? [{ squadId: { in: squadIds } }] : []),
        ],
      },
      userId,
      cursor,
      limit,
    );
  }

  async getTrending(userId: string, cursor?: string, limit = 20, cityId?: string) {
    const since = new Date(Date.now() - TRENDING_WINDOW_HOURS * 3600 * 1000);
    const candidates = await this.prisma.bean.findMany({
      where: {
        parentId: null,
        rebeanOfId: null,
        createdAt: { gte: since },
        ...(cityId ? { cityId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: this.beanInclude(userId),
    });
    const now = Date.now();
    const scored = candidates
      .map((b) => {
        const ageHours = (now - b.createdAt.getTime()) / 3600 / 1000;
        const engagement =
          b.reactionCount * 3 +
          b.replyCount * 4 +
          b.rebeanCount * 5 +
          b.quoteCount * 4;
        return { bean: b, score: engagement / Math.pow(ageHours + 2, 1.4) };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    const offset = cursor ? parseInt(cursor, 10) || 0 : 0;
    const page = scored.slice(offset, offset + limit);
    return {
      data: page.map((s) => this.decorate(s.bean)),
      nextCursor:
        offset + limit < scored.length ? String(offset + limit) : null,
    };
  }

  async getLocal(userId: string, cursor?: string, limit = 20) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { cityId: true },
    });
    if (!user.cityId) return { data: [], nextCursor: null };
    return this.listBeans(
      { parentId: null, cityId: user.cityId },
      userId,
      cursor,
      limit,
    );
  }

  async getFriends(userId: string, cursor?: string, limit = 20) {
    const friendships = await this.prisma.friendship.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      select: { userAId: true, userBId: true },
    });
    const friendIds = friendships.map((f) =>
      f.userAId === userId ? f.userBId : f.userAId,
    );
    if (!friendIds.length) return { data: [], nextCursor: null };
    return this.listBeans(
      { parentId: null, authorId: { in: friendIds } },
      userId,
      cursor,
      limit,
    );
  }

  getForCafe(cafeId: string, userId?: string, cursor?: string, limit = 20) {
    return this.listBeans({ parentId: null, cafeId }, userId, cursor, limit);
  }

  getForSquad(squadId: string, userId?: string, cursor?: string, limit = 20) {
    return this.listBeans({ parentId: null, squadId }, userId, cursor, limit);
  }

  getForEvent(eventId: string, userId?: string, cursor?: string, limit = 20) {
    return this.listBeans({ parentId: null, eventId }, userId, cursor, limit);
  }

  async getForUser(
    username: string,
    userId?: string,
    cursor?: string,
    limit = 20,
  ) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new NotFoundException('User not found');
    return this.listBeans(
      { parentId: null, authorId: user.id },
      userId,
      cursor,
      limit,
    );
  }

  async getByHashtag(
    tag: string,
    userId?: string,
    cursor?: string,
    limit = 20,
  ) {
    return this.listBeans(
      {
        hashtags: { some: { hashtag: { tag: tag.toLowerCase() } } },
      },
      userId,
      cursor,
      limit,
    );
  }

  // ===== Detail / replies =====

  async getById(id: string, userId?: string) {
    const bean = await this.prisma.bean.findUnique({
      where: { id },
      include: this.beanInclude(userId),
    });
    if (!bean) throw new NotFoundException('Bean not found');
    const breakdown = await this.prisma.beanReaction.groupBy({
      by: ['type'],
      where: { beanId: id },
      _count: { type: true },
    });
    return {
      ...this.decorate(bean),
      reactionBreakdown: Object.fromEntries(
        breakdown.map((b) => [b.type, b._count.type]),
      ),
    };
  }

  async getReplies(beanId: string, userId?: string, cursor?: string, limit = 20) {
    const items = await this.prisma.bean.findMany({
      where: { parentId: beanId },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'asc' },
      include: this.beanInclude(userId),
    });
    return this.paginate(items, limit);
  }

  // ===== Trending topics =====

  async getTrendingTopics(limit = 10) {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const grouped = await this.prisma.beanHashtag.groupBy({
      by: ['hashtagId'],
      where: { bean: { createdAt: { gte: since } } },
      _count: { hashtagId: true },
      orderBy: { _count: { hashtagId: 'desc' } },
      take: limit,
    });
    if (!grouped.length) return [];
    const hashtags = await this.prisma.hashtag.findMany({
      where: { id: { in: grouped.map((g) => g.hashtagId) } },
    });
    const byId = new Map(hashtags.map((h) => [h.id, h]));
    return grouped
      .map((g) => ({
        tag: byId.get(g.hashtagId)?.tag ?? '',
        recentCount: g._count.hashtagId,
        totalCount: byId.get(g.hashtagId)?.beanCount ?? 0,
      }))
      .filter((t) => t.tag);
  }

  // ===== Helpers =====

  private async listBeans(
    where: Prisma.BeanWhereInput,
    userId?: string,
    cursor?: string,
    limit = 20,
  ) {
    const items = await this.prisma.bean.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: this.beanInclude(userId),
    });
    return this.paginate(items, limit);
  }

  private inferType(input: CreateBeanInput): BeanType {
    if (input.cafeId) return BeanType.CAFE;
    if (input.eventId) return BeanType.EVENT;
    if (input.squadId) return BeanType.COMMUNITY;
    if (input.locationLabel || (input.lat != null && input.lng != null)) {
      return BeanType.LOCAL;
    }
    if (input.media?.some((m) => m.type === 'VIDEO')) return BeanType.VIDEO;
    if (input.media?.length) return BeanType.PHOTO;
    return BeanType.QUICK;
  }

  private extractHashtags(body?: string): string[] {
    if (!body) return [];
    const tags = new Set<string>();
    for (const match of body.matchAll(HASHTAG_RE)) {
      const tag = match[1].toLowerCase();
      if (tag.length >= 2 && tag.length <= 50) tags.add(tag);
    }
    return [...tags].slice(0, 10);
  }

  private async resolveMentions(body: string | undefined, authorId: string) {
    if (!body) return [];
    const usernames = new Set<string>();
    for (const match of body.matchAll(MENTION_RE)) {
      usernames.add(match[1].toLowerCase());
    }
    if (!usernames.size) return [];
    return this.prisma.user.findMany({
      where: { username: { in: [...usernames] }, id: { not: authorId } },
      select: { id: true, username: true },
      take: 10,
    });
  }

  private beanInclude(userId?: string) {
    const author = {
      select: { id: true, username: true, name: true, avatarUrl: true },
    };
    const context = {
      cafe: { select: { id: true, name: true, slug: true, logoUrl: true } },
      event: {
        select: { id: true, title: true, startsAt: true, coverUrl: true },
      },
      squad: { select: { id: true, name: true, slug: true, emoji: true } },
    };
    const nested = {
      author,
      ...context,
      media: { orderBy: { order: 'asc' as const } },
      poll: {
        include: {
          options: { orderBy: { order: 'asc' as const } },
          ...(userId ? { votes: { where: { userId }, take: 1 } } : {}),
        },
      },
      _count: {
        select: { replies: true, rebeans: true, quotes: true, reactions: true },
      },
      ...(userId
        ? {
            reactions: { where: { userId }, take: 1 },
            rebeans: { where: { authorId: userId }, take: 1 },
          }
        : {}),
    };
    return {
      ...nested,
      parent: { include: { author } },
      quotedBean: { include: nested },
      rebeanOf: { include: { ...nested, quotedBean: { include: nested } } },
    };
  }

  private paginate(items: BeanRow[], limit: number) {
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    return {
      data: data.map((b) => this.decorate(b)),
      nextCursor: hasMore ? data[data.length - 1]?.id : null,
    };
  }

  private decorate<T extends BeanRow>(bean: T): T & BeanDecorations {
    return {
      ...bean,
      myReaction: bean.reactions?.[0]?.type ?? null,
      rebeaned: Array.isArray(bean.rebeans) && bean.rebeans.length > 0,
      myPollOptionId: bean.poll?.votes?.[0]?.optionId ?? null,
      ...(bean.rebeanOf
        ? { rebeanOf: this.decorate(bean.rebeanOf as BeanRow) }
        : {}),
      ...(bean.quotedBean
        ? { quotedBean: this.decorate(bean.quotedBean as BeanRow) }
        : {}),
    };
  }
}

export interface BeanRow {
  id: string;
  reactions?: { type: BeanReactionType }[];
  rebeans?: unknown[];
  poll?: { votes?: { optionId: string }[] } | null;
  rebeanOf?: unknown;
  quotedBean?: unknown;
  createdAt: Date;
}

export interface BeanDecorations {
  myReaction: BeanReactionType | null;
  rebeaned: boolean;
  myPollOptionId: string | null;
}
