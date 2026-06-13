import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SmsService } from '../sms/sms.service';
import {
  requestSessionMeta,
  type SessionMeta,
} from '../common/utils/session-meta';
import { SettingsService } from '../settings/settings.service';

type TokenBundle = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    phone: string | null;
    email: string | null;
    username: string | null;
    name: string | null;
    bio: string | null;
    avatarUrl: string | null;
    cityId: string | null;
    countryId: string | null;
    role: string;
    city: unknown;
    needsOnboarding: boolean;
  };
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private jwt: JwtService,
    private config: ConfigService,
    private sms: SmsService,
  ) {}

  private sessionFromRequest(req?: {
    headers?: Record<string, string | string[] | undefined>;
    ip?: string;
  }): SessionMeta {
    return requestSessionMeta(req);
  }

  async requestOtp(phone: string) {
    const isMock = this.config.get('SMS_PROVIDER') === 'mock';
    const code = isMock
      ? '123456'
      : String(Math.floor(100000 + Math.random() * 900000));

    await this.redis.setOtp(phone, code);

    if (isMock) {
      return { message: 'OTP sent (mock)', code };
    }

    const templateId = Number(
      this.config.get<string>('SMSIR_OTP_TEMPLATE_ID') ?? '0',
    );
    await this.sms.sendVerifyCode(phone, templateId, [
      { name: 'Code', value: code },
    ]);

    return { message: 'OTP sent' };
  }

  async verifyOtp(
    phone: string,
    code: string,
    req?: { headers?: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    const stored = await this.redis.getOtp(phone);
    if (!stored || stored !== code) {
      throw new UnauthorizedException('Invalid OTP');
    }
    await this.redis.delOtp(phone);

    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await this.prisma.user.create({ data: { phone } });
    }
    return this.issueTokens(user.id, user.role, this.sessionFromRequest(req));
  }

  async validateGoogleUser(
    profile: {
      googleId: string;
      email?: string;
      name?: string;
      avatarUrl?: string;
    },
    req?: { headers?: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });
    if (!user && profile.email) {
      user = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });
    }
    if (user) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: profile.googleId,
          email: profile.email ?? user.email,
          name: user.name ?? profile.name,
          avatarUrl: user.avatarUrl ?? profile.avatarUrl,
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          googleId: profile.googleId,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
        },
      });
    }
    return this.issueTokens(user.id, user.role, this.sessionFromRequest(req));
  }

  async createGoogleAuthCode(tokens: TokenBundle) {
    const code = randomUUID();
    await this.redis.setAuthCode(code, tokens);
    return code;
  }

  async exchangeGoogleCode(code: string) {
    const tokens = await this.redis.getAuthCode(code);
    if (!tokens) {
      throw new UnauthorizedException('Invalid or expired auth code');
    }
    await this.redis.delAuthCode(code);
    return tokens;
  }

  async refresh(
    refreshToken: string,
    req?: { headers?: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    const parsed = this.parseRefreshToken(refreshToken);
    if (!parsed) {
      return this.refreshLegacy(refreshToken);
    }

    const record = await this.prisma.refreshToken.findFirst({
      where: {
        id: parsed.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!record) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const valid = await bcrypt.compare(parsed.secret, record.tokenHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), lastUsedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.issueTokens(user.id, user.role, this.sessionFromRequest(req));
  }

  private async refreshLegacy(refreshToken: string) {
    const users = await this.prisma.user.findMany({
      where: { refreshTokenHash: { not: null } },
    });
    for (const user of users) {
      if (
        user.refreshTokenHash &&
        (await bcrypt.compare(refreshToken, user.refreshTokenHash))
      ) {
        return this.issueTokens(user.id, user.role);
      }
    }
    throw new UnauthorizedException('Invalid refresh token');
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const parsed = this.parseRefreshToken(refreshToken);
      if (parsed) {
        await this.prisma.refreshToken.updateMany({
          where: { id: parsed.id, userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { message: 'Logged out' };
  }

  private parseRefreshToken(token: string): { id: string; secret: string } | null {
    const dot = token.indexOf('.');
    if (dot <= 0) return null;
    const id = token.slice(0, dot);
    const secret = token.slice(dot + 1);
    if (!id || !secret) return null;
    return { id, secret };
  }

  private refreshExpiresAt() {
    const raw = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const days = raw.endsWith('d') ? parseInt(raw, 10) : 7;
    const ms = (Number.isFinite(days) ? days : 7) * 86_400_000;
    return new Date(Date.now() + ms);
  }

  private async issueTokens(
    userId: string,
    role: string,
    meta?: SessionMeta,
  ): Promise<TokenBundle> {
    const payload = { sub: userId, role };
    const accessToken = await this.jwt.signAsync(payload);
    const secret = randomBytes(32).toString('hex');
    const tokenId = randomUUID();
    const refreshToken = `${tokenId}.${secret}`;
    const tokenHash = await bcrypt.hash(secret, 10);
    const expiresAt = this.refreshExpiresAt();

    await this.prisma.$transaction([
      this.prisma.refreshToken.create({
        data: {
          id: tokenId,
          userId,
          tokenHash,
          expiresAt,
          ...SettingsService.refreshTokenSessionPayload(meta),
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { refreshTokenHash: null },
      }),
    ]);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { city: true, country: true },
    });
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        username: user.username,
        name: user.name,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        cityId: user.cityId,
        countryId: user.countryId,
        role: user.role,
        city: user.city,
        needsOnboarding: !user.username || !user.cityId,
      },
    };
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }
}
