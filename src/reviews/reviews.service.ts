import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(
    authorId: string,
    cafeId: string,
    data: { rating: number; body?: string; photoUrls?: string[] },
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: authorId },
    });
    const cafe = await this.prisma.cafe.findUniqueOrThrow({
      where: { id: cafeId },
    });
    const review = await this.prisma.review.create({
      data: {
        cafeId,
        authorId,
        rating: data.rating,
        body: data.body,
        cityId: cafe.cityId,
        countryId: cafe.countryId,
        photos: data.photoUrls?.length
          ? { create: data.photoUrls.map((url) => ({ url })) }
          : undefined,
      },
      include: {
        author: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
        photos: true,
      },
    });
    const agg = await this.prisma.review.aggregate({
      where: { cafeId },
      _avg: { rating: true },
      _count: true,
    });
    await this.prisma.cafe.update({
      where: { id: cafeId },
      data: {
        avgRating: agg._avg.rating ?? 0,
        reviewCount: agg._count,
      },
    });
    return review;
  }

  listByCafe(cafeId: string) {
    return this.prisma.review.findMany({
      where: { cafeId },
      include: {
        author: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
        photos: true,
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
