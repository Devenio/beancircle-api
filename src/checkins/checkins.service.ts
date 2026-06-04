import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PassportService } from '../passport/passport.service';

@Injectable()
export class CheckinsService {
  constructor(
    private prisma: PrismaService,
    private passportService: PassportService,
  ) {}

  create(userId: string, cafeId: string) {
    return this.passportService.checkin(userId, { cafeId });
  }

  list(userId?: string) {
    return this.prisma.checkin.findMany({
      where: userId ? { userId } : {},
      include: {
        cafe: { include: { photos: { take: 1 } } },
        user: { select: { id: true, username: true, name: true, avatarUrl: true } },
        stamp: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
