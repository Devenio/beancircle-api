import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AutoDownloadMode,
  DiscoveryVisibility,
  FontSizeLevel,
  LocationVisibility,
  MediaQualityLevel,
  MessageDensityLevel,
  VisibilityLevel,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SETTINGS_DEFAULTS } from './settings.constants';
import { SettingsService } from './settings.service';

const userId = 'user-test-1';

function baseSettings(overrides: Record<string, unknown> = {}) {
  return {
    userId,
    lastSeenVisibility: VisibilityLevel.EVERYONE,
    onlineStatusVisibility: VisibilityLevel.EVERYONE,
    readReceipts: true,
    profileVisibility: VisibilityLevel.EVERYONE,
    pushNotifications: true,
    messageNotifications: true,
    mentionNotifications: true,
    groupNotifications: true,
    marketingNotifications: false,
    emailNotifications: true,
    notificationSound: true,
    notificationVibration: true,
    accentColor: SETTINGS_DEFAULTS.accentColor,
    fontSize: FontSizeLevel.MEDIUM,
    messageDensity: MessageDensityLevel.COMFORTABLE,
    chatWallpaper: 'default',
    autoDownloadMedia: AutoDownloadMode.WIFI,
    mediaQuality: MediaQualityLevel.HIGH,
    saveDrafts: true,
    linkPreviews: true,
    typingIndicators: true,
    autoCleanupDays: 30,
    locationVisibility: LocationVisibility.APPROXIMATE,
    discoveryVisibility: DiscoveryVisibility.EVERYONE,
    showOnlineStatus: true,
    updatedAt: new Date('2026-06-05T12:00:00.000Z'),
    ...overrides,
  };
}

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: {
    userSettings: {
      upsert: jest.Mock;
      update: jest.Mock;
    };
    user: {
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
    userBlock: { findMany: jest.Mock };
    conversationMember: { findMany: jest.Mock };
    refreshToken: { findMany: jest.Mock; updateMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      userSettings: {
        upsert: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      userBlock: { findMany: jest.fn().mockResolvedValue([]) },
      conversationMember: { findMany: jest.fn().mockResolvedValue([]) },
      refreshToken: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(SettingsService);
  });

  describe('getSettings', () => {
    it('creates defaults via upsert and returns serialized settings', async () => {
      const row = baseSettings();
      prisma.userSettings.upsert.mockResolvedValue(row);
      prisma.user.findUniqueOrThrow.mockResolvedValue({ showLastSeen: true });

      const result = await service.getSettings(userId);

      expect(prisma.userSettings.upsert).toHaveBeenCalledWith({
        where: { userId },
        create: { userId },
        update: {},
      });
      expect(result.readReceipts).toBe(true);
      expect(result.fontSize).toBe('medium');
      expect(result.autoDownloadMedia).toBe('wifi');
      expect(result.showLastSeen).toBe(true);
      expect(result.updatedAt).toBe(row.updatedAt.toISOString());
    });
  });

  describe('updateSettings', () => {
    it('persists readReceipts and typingIndicators', async () => {
      prisma.userSettings.upsert.mockResolvedValue(baseSettings());
      prisma.userSettings.update.mockResolvedValue(
        baseSettings({ readReceipts: false, typingIndicators: false }),
      );
      prisma.user.findUniqueOrThrow.mockResolvedValue({ showLastSeen: true });

      const result = await service.updateSettings(userId, {
        readReceipts: false,
        typingIndicators: false,
      });

      expect(prisma.userSettings.update).toHaveBeenCalledWith({
        where: { userId },
        data: expect.objectContaining({
          readReceipts: false,
          typingIndicators: false,
        }),
      });
      expect(result.readReceipts).toBe(false);
      expect(result.typingIndicators).toBe(false);
    });

    it('syncs showLastSeen on User when lastSeenVisibility is nobody', async () => {
      prisma.userSettings.upsert.mockResolvedValue(baseSettings());
      prisma.userSettings.update.mockResolvedValue(
        baseSettings({ lastSeenVisibility: VisibilityLevel.NOBODY }),
      );
      prisma.user.findUniqueOrThrow.mockResolvedValue({ showLastSeen: false });
      prisma.user.update.mockResolvedValue({});

      await service.updateSettings(userId, { lastSeenVisibility: 'nobody' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { showLastSeen: false },
      });
    });

    it('maps appearance enums correctly', async () => {
      prisma.userSettings.upsert.mockResolvedValue(baseSettings());
      prisma.userSettings.update.mockResolvedValue(
        baseSettings({
          fontSize: FontSizeLevel.LARGE,
          messageDensity: MessageDensityLevel.COMPACT,
          autoDownloadMedia: AutoDownloadMode.NEVER,
          mediaQuality: MediaQualityLevel.STANDARD,
        }),
      );
      prisma.user.findUniqueOrThrow.mockResolvedValue({ showLastSeen: true });

      const result = await service.updateSettings(userId, {
        fontSize: 'large',
        messageDensity: 'compact',
        autoDownloadMedia: 'never',
        mediaQuality: 'standard',
      });

      expect(result.fontSize).toBe('large');
      expect(result.messageDensity).toBe('compact');
      expect(result.autoDownloadMedia).toBe('never');
      expect(result.mediaQuality).toBe('standard');
    });
  });

  describe('listSessions', () => {
    it('marks current session when currentSessionId matches', async () => {
      prisma.refreshToken.findMany.mockResolvedValue([
        {
          id: 'sess-1',
          userAgent: 'Mozilla/5.0 (iPhone)',
          deviceName: 'Mobile',
          browser: 'Safari',
          os: 'iOS',
          ipAddress: '1.2.3.4',
          createdAt: new Date(),
          lastUsedAt: new Date(),
        },
        {
          id: 'sess-2',
          userAgent: null,
          deviceName: null,
          browser: null,
          os: null,
          ipAddress: null,
          createdAt: new Date(),
          lastUsedAt: new Date(),
        },
      ]);

      const sessions = await service.listSessions(userId, 'sess-1');
      expect(sessions[0].current).toBe(true);
      expect(sessions[1].current).toBeFalsy();
    });
  });

  describe('revokeSession', () => {
    it('throws when session not found', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.revokeSession(userId, 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('revokes matching session', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      const result = await service.revokeSession(userId, 'sess-1');
      expect(result).toEqual({ revoked: true });
    });
  });
});
