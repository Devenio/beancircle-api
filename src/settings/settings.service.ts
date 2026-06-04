import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseUserAgent, type SessionMeta } from '../common/utils/session-meta';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import {
  fromAutoDownload,
  fromDensity,
  fromFontSize,
  fromMediaQuality,
  fromVisibilityLevel,
  toAutoDownload,
  toDensity,
  toFontSize,
  toMediaQuality,
  toVisibilityLevel,
} from './settings.mapper';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async ensureSettings(userId: string) {
    return this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async getSettings(userId: string) {
    const [user, settings] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { showLastSeen: true },
      }),
      this.ensureSettings(userId),
    ]);
    return this.serialize(settings, user.showLastSeen);
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    await this.ensureSettings(userId);
    const data: Prisma.UserSettingsUpdateInput = {};

    if (dto.lastSeenVisibility !== undefined) {
      data.lastSeenVisibility = toVisibilityLevel(dto.lastSeenVisibility);
      await this.prisma.user.update({
        where: { id: userId },
        data: { showLastSeen: dto.lastSeenVisibility !== 'nobody' },
      });
    }
    if (dto.onlineStatusVisibility !== undefined) {
      data.onlineStatusVisibility = toVisibilityLevel(dto.onlineStatusVisibility);
    }
    if (dto.profileVisibility !== undefined) {
      data.profileVisibility = toVisibilityLevel(dto.profileVisibility);
    }
    if (dto.readReceipts !== undefined) data.readReceipts = dto.readReceipts;
    if (dto.pushNotifications !== undefined) data.pushNotifications = dto.pushNotifications;
    if (dto.messageNotifications !== undefined) {
      data.messageNotifications = dto.messageNotifications;
    }
    if (dto.mentionNotifications !== undefined) {
      data.mentionNotifications = dto.mentionNotifications;
    }
    if (dto.groupNotifications !== undefined) data.groupNotifications = dto.groupNotifications;
    if (dto.marketingNotifications !== undefined) {
      data.marketingNotifications = dto.marketingNotifications;
    }
    if (dto.emailNotifications !== undefined) data.emailNotifications = dto.emailNotifications;
    if (dto.notificationSound !== undefined) data.notificationSound = dto.notificationSound;
    if (dto.notificationVibration !== undefined) {
      data.notificationVibration = dto.notificationVibration;
    }
    if (dto.accentColor !== undefined) data.accentColor = dto.accentColor;
    if (dto.fontSize !== undefined) data.fontSize = toFontSize(dto.fontSize);
    if (dto.messageDensity !== undefined) data.messageDensity = toDensity(dto.messageDensity);
    if (dto.chatWallpaper !== undefined) data.chatWallpaper = dto.chatWallpaper;
    if (dto.autoDownloadMedia !== undefined) {
      data.autoDownloadMedia = toAutoDownload(dto.autoDownloadMedia);
    }
    if (dto.mediaQuality !== undefined) data.mediaQuality = toMediaQuality(dto.mediaQuality);
    if (dto.saveDrafts !== undefined) data.saveDrafts = dto.saveDrafts;
    if (dto.linkPreviews !== undefined) data.linkPreviews = dto.linkPreviews;
    if (dto.typingIndicators !== undefined) data.typingIndicators = dto.typingIndicators;
    if (dto.autoCleanupDays !== undefined) data.autoCleanupDays = dto.autoCleanupDays;

    if (dto.showLastSeen !== undefined) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { showLastSeen: dto.showLastSeen },
      });
    }

    const settings = await this.prisma.userSettings.update({
      where: { userId },
      data,
    });
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { showLastSeen: true },
    });
    return this.serialize(settings, user.showLastSeen);
  }

  private serialize(
    settings: Awaited<ReturnType<typeof this.ensureSettings>>,
    showLastSeen: boolean,
  ) {
    return {
      lastSeenVisibility: fromVisibilityLevel(settings.lastSeenVisibility),
      onlineStatusVisibility: fromVisibilityLevel(settings.onlineStatusVisibility),
      readReceipts: settings.readReceipts,
      profileVisibility: fromVisibilityLevel(settings.profileVisibility),
      showLastSeen,
      pushNotifications: settings.pushNotifications,
      messageNotifications: settings.messageNotifications,
      mentionNotifications: settings.mentionNotifications,
      groupNotifications: settings.groupNotifications,
      marketingNotifications: settings.marketingNotifications,
      emailNotifications: settings.emailNotifications,
      notificationSound: settings.notificationSound,
      notificationVibration: settings.notificationVibration,
      accentColor: settings.accentColor,
      fontSize: fromFontSize(settings.fontSize),
      messageDensity: fromDensity(settings.messageDensity),
      chatWallpaper: settings.chatWallpaper,
      autoDownloadMedia: fromAutoDownload(settings.autoDownloadMedia),
      mediaQuality: fromMediaQuality(settings.mediaQuality),
      saveDrafts: settings.saveDrafts,
      linkPreviews: settings.linkPreviews,
      typingIndicators: settings.typingIndicators,
      autoCleanupDays: settings.autoCleanupDays,
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  async listBlockedUsers(userId: string) {
    const rows = await this.prisma.userBlock.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        blocked: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
    });
    return rows.map((r) => ({
      id: r.blocked.id,
      username: r.blocked.username,
      name: r.blocked.name,
      avatarUrl: r.blocked.avatarUrl,
      blockedAt: r.createdAt.toISOString(),
    }));
  }

  async listMutedUsers(userId: string) {
    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId, muted: true },
      include: {
        conversation: {
          include: {
            members: {
              where: { userId: { not: userId } },
              include: {
                user: {
                  select: { id: true, username: true, name: true, avatarUrl: true },
                },
              },
              take: 1,
            },
          },
        },
      },
    });
    const seen = new Set<string>();
    const result: {
      id: string;
      username: string | null;
      name: string | null;
      avatarUrl: string | null;
      conversationId: string;
    }[] = [];

    for (const m of memberships) {
      const peer = m.conversation.members[0]?.user;
      if (!peer || seen.has(peer.id)) continue;
      seen.add(peer.id);
      result.push({
        id: peer.id,
        username: peer.username,
        name: peer.name,
        avatarUrl: peer.avatarUrl,
        conversationId: m.conversationId,
      });
    }
    return result;
  }

  async listSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
    return sessions.map((s) => {
      const parsed = parseUserAgent(s.userAgent ?? undefined);
      return {
        id: s.id,
        deviceName: s.deviceName ?? parsed.deviceName,
        browser: s.browser ?? parsed.browser,
        os: s.os ?? parsed.os,
        location: s.ipAddress ?? undefined,
        loginAt: s.createdAt.toISOString(),
        lastUsedAt: s.lastUsedAt.toISOString(),
        current: currentSessionId ? s.id === currentSessionId : false,
      };
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    const updated = await this.prisma.refreshToken.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!updated.count) throw new NotFoundException('Session not found');
    return { revoked: true };
  }

  static refreshTokenSessionPayload(meta?: SessionMeta) {
    const parsed = parseUserAgent(meta?.userAgent);
    return {
      deviceName: parsed.deviceName,
      browser: parsed.browser,
      os: parsed.os,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      lastUsedAt: new Date(),
    };
  }
}
