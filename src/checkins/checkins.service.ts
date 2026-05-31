import { BadRequestException, Injectable } from '@nestjs/common';
import { PostType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CheckinsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, cafeId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const cafe = await this.prisma.cafe.findUniqueOrThrow({
      where: { id: cafeId },
    });
    if (!user.cityId) {
      throw new BadRequestException('Complete profile with city first');
    }

    const checkin = await this.prisma.checkin.create({
      data: {
        userId,
        cafeId,
        cityId: cafe.cityId,
        countryId: cafe.countryId,
      },
      include: {
        cafe: true,
        user: { select: { id: true, username: true, name: true, avatarUrl: true } },
      },
    });

    await this.prisma.post.create({
      data: {
        authorId: userId,
        cafeId,
        checkinId: checkin.id,
        type: PostType.CHECKIN,
        caption: `${user.name ?? user.username} checked in at ${cafe.name}`,
        cityId: cafe.cityId,
        countryId: cafe.countryId,
      },
    });

    return checkin;
  }

  list(userId?: string) {
    return this.prisma.checkin.findMany({
      where: userId ? { userId } : {},
      include: {
        cafe: { include: { photos: { take: 1 } } },
        user: { select: { id: true, username: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
