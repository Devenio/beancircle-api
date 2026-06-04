/**
 * Integration tests against a real database.
 * Run: DATABASE_URL=... pnpm test:e2e -- settings.integration-spec
 * Skipped when DATABASE_URL is unset or SKIP_SETTINGS_INTEGRATION=1.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SETTINGS_DEFAULTS, SETTINGS_RESPONSE_KEYS } from '../src/settings/settings.constants';

const runIntegration =
  Boolean(process.env.DATABASE_URL) && process.env.SKIP_SETTINGS_INTEGRATION !== '1';

(runIntegration ? describe : describe.skip)('Settings API (integration)', () => {
  let migrationReady = false;
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;
  const testPhone = `+98919${String(Date.now()).slice(-7)}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);

    try {
      await prisma.userSettings.findFirst();
      migrationReady = true;
    } catch {
      migrationReady = false;
      console.warn(
        'Skipping settings integration assertions: run `pnpm prisma migrate deploy` first.',
      );
    }

    const user = await prisma.user.create({
      data: { phone: testPhone, username: `set_${Date.now()}`, name: 'Settings Test' },
    });
    userId = user.id;
    accessToken = await jwt.signAsync({ sub: userId, role: 'USER' });
  });

  afterAll(async () => {
    if (userId) {
      await prisma.userSettings.deleteMany({ where: { userId } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    }
    await app.close();
  });

  it('GET /settings creates row with defaults', async () => {
    if (!migrationReady) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    for (const key of SETTINGS_RESPONSE_KEYS) {
      expect(res.body).toHaveProperty(key);
    }
    expect(res.body.readReceipts).toBe(SETTINGS_DEFAULTS.readReceipts);
    expect(res.body.fontSize).toBe(SETTINGS_DEFAULTS.fontSize);

    const row = await prisma.userSettings.findUnique({ where: { userId } });
    expect(row).not.toBeNull();
  });

  it('PATCH /settings persists and survives refresh', async () => {
    if (!migrationReady) return;
    await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        readReceipts: false,
        pushNotifications: false,
        fontSize: 'large',
        autoCleanupDays: 90,
      })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(after.body.readReceipts).toBe(false);
    expect(after.body.pushNotifications).toBe(false);
    expect(after.body.fontSize).toBe('large');
    expect(after.body.autoCleanupDays).toBe(90);

    const row = await prisma.userSettings.findUniqueOrThrow({ where: { userId } });
    expect(row.readReceipts).toBe(false);
    expect(row.fontSize).toBe('LARGE');
  });

  it('PATCH lastSeenVisibility nobody updates User.showLastSeen', async () => {
    if (!migrationReady) return;
    await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ lastSeenVisibility: 'nobody' })
      .expect(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.showLastSeen).toBe(false);
  });

  it('rejects unauthenticated GET /settings', async () => {
    await request(app.getHttpServer()).get('/api/v1/settings').expect(401);
  });

  it('rejects invalid PATCH body', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fontSize: 'huge' })
      .expect(400);
  });
});
