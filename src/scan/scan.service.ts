import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import { FriendsService } from '../friends/friends.service';
import { PrismaService } from '../prisma/prisma.service';

export type ScanResolveResult =
  | {
      type: 'cafe_checkin';
      cafe: {
        id: string;
        name: string;
        checkinCode: string;
        isPartner: boolean;
      };
    }
  | {
      type: 'user_connect';
      user: {
        id: string;
        username: string;
        name: string | null;
        avatarUrl: string | null;
      };
      relationship: 'none' | 'pending_out' | 'pending_in' | 'friends' | 'self';
    }
  | {
      type: 'referral';
      code: string;
      referrer: {
        id: string;
        username: string | null;
        name: string | null;
      };
    }
  | {
      type: 'daily_deal_voucher';
      winnerId: string;
      voucherCode: string;
      redeemed: boolean;
      cafe: { id: string; name: string };
      ownedByViewer: boolean;
    }
  | {
      type: 'unknown';
      raw: string;
    };

@Injectable()
export class ScanService {
  constructor(
    private prisma: PrismaService,
    private friends: FriendsService,
    private config: ConfigService,
  ) {}

  async resolve(viewerId: string, raw: string): Promise<ScanResolveResult> {
    const payload = raw.trim();
    if (!payload) {
      return { type: 'unknown', raw: payload };
    }

    const extracted = this.extractCode(payload);
    const normalized = extracted.toUpperCase();

    if (normalized.startsWith('BC-FREE-')) {
      return this.resolveDailyDeal(viewerId, normalized);
    }

    const username = this.extractUsername(payload);
    if (username) {
      return this.resolveUser(viewerId, username);
    }

    if (normalized.startsWith('BC-')) {
      const cafe = await this.prisma.cafe.findUnique({
        where: { checkinCode: normalized },
      });
      if (cafe) {
        return {
          type: 'cafe_checkin',
          cafe: {
            id: cafe.id,
            name: cafe.name,
            checkinCode: cafe.checkinCode!,
            isPartner: cafe.isPartner,
          },
        };
      }
    }

    if (/^[A-F0-9]{8}$/.test(normalized)) {
      const referrer = await this.prisma.user.findUnique({
        where: { referralCode: normalized },
        select: { id: true, username: true, name: true },
      });
      if (referrer) {
        return {
          type: 'referral',
          code: normalized,
          referrer,
        };
      }
    }

    return { type: 'unknown', raw: payload };
  }

  private extractCode(payload: string): string {
    if (payload.startsWith('bc://')) {
      const path = payload.replace(/^bc:\/\//i, '');
      const referralMatch = path.match(/^referral\/([A-Za-z0-9]+)$/i);
      if (referralMatch) return referralMatch[1]!.toUpperCase();
      return payload;
    }

    try {
      const url = payload.includes('://')
        ? new URL(payload)
        : new URL(payload, 'https://beancircle.app');
      const codeParam = url.searchParams.get('code');
      if (codeParam) return codeParam.trim();
      const profileMatch = url.pathname.match(/\/profile\/([^/?#]+)/i);
      if (profileMatch) return `@${profileMatch[1]}`;
    } catch {
      /* not a URL */
    }

    return payload;
  }

  private extractUsername(payload: string): string | null {
    if (payload.startsWith('bc://')) {
      const path = payload.replace(/^bc:\/\//i, '');
      const connectMatch = path.match(/^connect\/([a-z0-9_]+)$/i);
      if (connectMatch) return connectMatch[1]!.toLowerCase();
      const userMatch = path.match(/^user\/([a-z0-9_]+)$/i);
      if (userMatch) return userMatch[1]!.toLowerCase();
    }

    if (payload.startsWith('BC-USER-')) {
      return payload.slice('BC-USER-'.length).toLowerCase();
    }

    if (payload.startsWith('@')) {
      const username = payload.slice(1).trim().toLowerCase();
      return /^[a-z0-9_]{3,30}$/.test(username) ? username : null;
    }

    try {
      const url = payload.includes('://')
        ? new URL(payload)
        : new URL(payload, 'https://beancircle.app');
      const profileMatch = url.pathname.match(/\/profile\/([^/?#]+)/i);
      if (profileMatch) {
        const username = profileMatch[1]!.toLowerCase();
        return /^[a-z0-9_]{3,30}$/.test(username) ? username : null;
      }
    } catch {
      /* not a URL */
    }

    return null;
  }

  private async resolveUser(
    viewerId: string,
    username: string,
  ): Promise<ScanResolveResult> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, name: true, avatarUrl: true },
    });
    if (!user?.username) {
      return { type: 'unknown', raw: `@${username}` };
    }

    const relationship = await this.friends.getRelationship(viewerId, user.id);
    return {
      type: 'user_connect',
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      relationship,
    };
  }

  private async resolveDailyDeal(
    viewerId: string,
    voucherCode: string,
  ): Promise<ScanResolveResult> {
    const winner = await this.prisma.cafeDailyDrawWinner.findUnique({
      where: { voucherCode },
      include: { draw: { include: { cafe: true } } },
    });
    if (!winner) {
      return { type: 'unknown', raw: voucherCode };
    }

    return {
      type: 'daily_deal_voucher',
      winnerId: winner.id,
      voucherCode: winner.voucherCode,
      redeemed: winner.redeemedAt != null,
      cafe: {
        id: winner.draw.cafe.id,
        name: winner.draw.cafe.name,
      },
      ownedByViewer: winner.userId === viewerId,
    };
  }

  buildConnectPayload(username: string) {
    return `bc://connect/${username}`;
  }

  buildConnectUrl(username: string) {
    const base = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    return `${base.replace(/\/$/, '')}/profile/${username}`;
  }

  async getMyConnectQr(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { username: true, name: true },
    });
    if (!user.username) {
      throw new BadRequestException('Set a username to share your connect QR');
    }

    const payload = this.buildConnectPayload(user.username);
    const url = this.buildConnectUrl(user.username);
    const qrDataUrl = await QRCode.toDataURL(payload, { margin: 1 });

    return {
      username: user.username,
      name: user.name,
      payload,
      url,
      qrDataUrl,
    };
  }
}
