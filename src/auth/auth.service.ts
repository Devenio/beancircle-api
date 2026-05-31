import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async requestOtp(phone: string) {
    const code =
      this.config.get('SMS_PROVIDER') === 'mock'
        ? '123456'
        : String(Math.floor(100000 + Math.random() * 900000));
    await this.redis.setOtp(phone, code);
    if (this.config.get('SMS_PROVIDER') === 'mock') {
      return { message: 'OTP sent (mock)', code };
    }
    return { message: 'OTP sent' };
  }

  async verifyOtp(phone: string, code: string) {
    const stored = await this.redis.getOtp(phone);
    if (!stored || stored !== code) {
      throw new UnauthorizedException('Invalid OTP');
    }
    await this.redis.delOtp(phone);

    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await this.prisma.user.create({ data: { phone } });
    }
    return this.issueTokens(user.id, user.role);
  }

  async validateGoogleUser(profile: {
    googleId: string;
    email?: string;
    name?: string;
    avatarUrl?: string;
  }) {
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
    return this.issueTokens(user.id, user.role);
  }

  async refresh(refreshToken: string) {
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

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { message: 'Logged out' };
  }

  private async issueTokens(userId: string, role: string) {
    const payload = { sub: userId, role };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: await bcrypt.hash(refreshToken, 10) },
    });
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
