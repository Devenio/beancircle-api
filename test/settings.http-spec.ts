import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { SettingsController } from '../src/settings/settings.controller';
import { SettingsService } from '../src/settings/settings.service';
import { SETTINGS_RESPONSE_KEYS } from '../src/settings/settings.constants';

const mockUser = { id: 'user-abc', role: 'USER' };

const mockSettingsPayload = Object.fromEntries(
  SETTINGS_RESPONSE_KEYS.filter((k) => k !== 'updatedAt').map((k) => [
    k,
    k === 'autoCleanupDays'
      ? 30
      : k === 'marketingNotifications'
        ? false
        : typeof k === 'string' && k.includes('Visibility')
          ? 'everyone'
          : k === 'fontSize'
            ? 'medium'
            : k === 'messageDensity'
              ? 'comfortable'
              : k === 'autoDownloadMedia'
                ? 'wifi'
                : k === 'mediaQuality'
                  ? 'high'
                  : k === 'accentColor'
                    ? 'oklch(0.55 0.2 145)'
                    : k === 'chatWallpaper'
                      ? 'default'
                      : true,
  ]),
) as Record<string, unknown>;

mockSettingsPayload.updatedAt = new Date().toISOString();

describe('Settings HTTP', () => {
  let app: INestApplication<App>;
  const settingsService = {
    getSettings: jest.fn().mockResolvedValue(mockSettingsPayload),
    updateSettings: jest.fn().mockResolvedValue({
      ...mockSettingsPayload,
      readReceipts: false,
    }),
    listBlockedUsers: jest.fn().mockResolvedValue([]),
    listMutedUsers: jest.fn().mockResolvedValue([]),
    listSessions: jest.fn().mockResolvedValue([]),
    revokeSession: jest.fn().mockResolvedValue({ revoked: true }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [{ provide: SettingsService, useValue: settingsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use((req, _res, next) => {
      req.user = mockUser;
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /settings returns settings for authenticated user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/settings')
      .expect(200);

    expect(settingsService.getSettings).toHaveBeenCalledWith(mockUser.id);
    for (const key of SETTINGS_RESPONSE_KEYS) {
      expect(res.body).toHaveProperty(key);
    }
  });

  it('PATCH /settings updates settings', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .send({ readReceipts: false })
      .expect(200);

    expect(settingsService.updateSettings).toHaveBeenCalledWith(
      mockUser.id,
      expect.objectContaining({ readReceipts: false }),
    );
    expect(res.body.readReceipts).toBe(false);
  });

  it('PATCH /settings rejects invalid visibility value', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .send({ lastSeenVisibility: 'invalid' })
      .expect(400);
  });

  it('PATCH /settings rejects unknown fields', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .send({ unknownField: true })
      .expect(400);
  });

  it('PATCH /settings rejects autoCleanupDays below minimum', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .send({ autoCleanupDays: 3 })
      .expect(400);
  });

  it('GET /settings/blocked returns array', async () => {
    await request(app.getHttpServer()).get('/api/v1/settings/blocked').expect(200);
    expect(settingsService.listBlockedUsers).toHaveBeenCalledWith(mockUser.id);
  });

  it('GET /settings/muted returns array', async () => {
    await request(app.getHttpServer()).get('/api/v1/settings/muted').expect(200);
    expect(settingsService.listMutedUsers).toHaveBeenCalledWith(mockUser.id);
  });

  it('GET /settings/sessions returns array', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/settings/sessions?currentSessionId=abc')
      .expect(200);
    expect(settingsService.listSessions).toHaveBeenCalledWith(mockUser.id, 'abc');
  });

  it('DELETE /settings/sessions/:id revokes session', async () => {
    await request(app.getHttpServer())
      .delete('/api/v1/settings/sessions/sess-1')
      .expect(200);
    expect(settingsService.revokeSession).toHaveBeenCalledWith(
      mockUser.id,
      'sess-1',
    );
  });
});

