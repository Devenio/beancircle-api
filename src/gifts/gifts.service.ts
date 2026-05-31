import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GiftStatus, NotificationType } from '@prisma/client';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class GiftsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private config: ConfigService,
  ) {}

  async create(senderId: string, amount: number) {
    const sender = await this.prisma.user.findUniqueOrThrow({
      where: { id: senderId },
    });
    if (!sender.cityId) {
      throw new BadRequestException('Set city on profile first');
    }
    const gift = await this.prisma.giftCoffee.create({
      data: {
        senderId,
        amount,
        cityId: sender.cityId,
        countryId: sender.countryId!,
        status: GiftStatus.PENDING_PAYMENT,
        paymentRef: `mock-${Date.now()}`,
      },
    });
    if (this.config.get('PAYMENT_PROVIDER') === 'mock') {
      return this.completePayment(gift.id);
    }
    return {
      gift,
      paymentUrl: `${this.config.get('FRONTEND_URL')}/gift/pay/${gift.id}`,
    };
  }

  async completePayment(giftId: string) {
    const gift = await this.prisma.giftCoffee.findUniqueOrThrow({
      where: { id: giftId },
    });
    if (gift.status !== GiftStatus.PENDING_PAYMENT) {
      return gift;
    }

    const receivers = await this.prisma.user.findMany({
      where: {
        cityId: gift.cityId,
        NOT: { id: gift.senderId },
        username: { not: null },
      },
    });
    if (!receivers.length) {
      throw new BadRequestException('No receivers in city');
    }
    const receiver = receivers[Math.floor(Math.random() * receivers.length)];
    const voucherCode = `BC-${Date.now().toString(36).toUpperCase()}`;

    const updated = await this.prisma.giftCoffee.update({
      where: { id: giftId },
      data: {
        status: GiftStatus.ASSIGNED,
        receiverId: receiver.id,
        voucherCode,
      },
      include: {
        sender: { select: { id: true, name: true, username: true } },
        receiver: { select: { id: true, name: true, username: true } },
      },
    });

    await this.notifications.create({
      userId: receiver.id,
      type: NotificationType.GIFT_COFFEE,
      actorId: gift.senderId,
      entityType: 'gift',
      entityId: gift.id,
      payload: { amount: gift.amount, voucherCode },
    });

    return updated;
  }

  async getVoucher(giftId: string, userId: string) {
    const gift = await this.prisma.giftCoffee.findUniqueOrThrow({
      where: { id: giftId },
    });
    if (gift.receiverId !== userId) {
      throw new NotFoundException('Gift not found');
    }
    const qrDataUrl = gift.voucherCode
      ? await QRCode.toDataURL(gift.voucherCode)
      : null;
    return { gift, qrDataUrl };
  }

  async redeem(voucherCode: string, cafeId: string, userId?: string) {
    const gift = await this.prisma.giftCoffee.findUnique({
      where: { voucherCode },
    });
    if (!gift || gift.status === GiftStatus.REDEEMED) {
      throw new NotFoundException('Invalid voucher');
    }
    const cafe = await this.prisma.cafe.findUniqueOrThrow({
      where: { id: cafeId },
    });
    if (!cafe.isPartner) {
      throw new BadRequestException('Cafe is not a partner');
    }
    await this.prisma.$transaction([
      this.prisma.giftCoffee.update({
        where: { id: gift.id },
        data: { status: GiftStatus.REDEEMED },
      }),
      this.prisma.voucherRedemption.create({
        data: {
          giftId: gift.id,
          cafeId,
          redeemedByUserId: userId,
        },
      }),
    ]);
    return { redeemed: true };
  }

  listAll() {
    return this.prisma.giftCoffee.findMany({
      include: {
        sender: { select: { id: true, username: true, name: true } },
        receiver: { select: { id: true, username: true, name: true } },
        city: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
