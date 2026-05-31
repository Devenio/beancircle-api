import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CafesService {
  constructor(private prisma: PrismaService) {}

  list(cityId?: string, q?: string) {
    return this.prisma.cafe.findMany({
      where: {
        ...(cityId ? { cityId } : {}),
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      include: { photos: { take: 1, orderBy: { order: 'asc' } }, city: true },
      orderBy: { followerCount: 'desc' },
      take: 50,
    });
  }

  async get(id: string, userId?: string) {
    const cafe = await this.prisma.cafe.findUnique({
      where: { id },
      include: {
        photos: { orderBy: { order: 'asc' } },
        city: true,
        reviews: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            author: {
              select: { id: true, username: true, name: true, avatarUrl: true },
            },
            photos: true,
          },
        },
      },
    });
    if (!cafe) throw new NotFoundException('Cafe not found');
    let isFollowing = false;
    if (userId) {
      const f = await this.prisma.cafeFollow.findUnique({
        where: { userId_cafeId: { userId, cafeId: id } },
      });
      isFollowing = !!f;
    }
    return { ...cafe, isFollowing };
  }

  async follow(userId: string, cafeId: string) {
    await this.prisma.$transaction([
      this.prisma.cafeFollow.upsert({
        where: { userId_cafeId: { userId, cafeId } },
        create: { userId, cafeId },
        update: {},
      }),
      this.prisma.cafe.update({
        where: { id: cafeId },
        data: { followerCount: { increment: 1 } },
      }),
    ]);
    return { following: true };
  }

  async unfollow(userId: string, cafeId: string) {
    const r = await this.prisma.cafeFollow.deleteMany({
      where: { userId, cafeId },
    });
    if (r.count) {
      await this.prisma.cafe.update({
        where: { id: cafeId },
        data: { followerCount: { decrement: 1 } },
      });
    }
    return { following: false };
  }

  create(data: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    cityId: string;
    countryId: string;
    isPartner?: boolean;
  }) {
    return this.prisma.cafe.create({ data });
  }

  update(id: string, data: Partial<{ name: string; address: string; isPartner: boolean }>) {
    return this.prisma.cafe.update({ where: { id }, data });
  }
}
