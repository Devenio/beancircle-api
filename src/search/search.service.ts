import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async search(q: string, type: 'users' | 'cafes' | 'all' = 'all', cityId?: string) {
    const query = q.trim();
    if (!query) return { users: [], cafes: [] };

    const users =
      type === 'cafes'
        ? []
        : await this.prisma.user.findMany({
            where: {
              AND: [
                {
                  OR: [
                    { username: { contains: query, mode: 'insensitive' } },
                    { name: { contains: query, mode: 'insensitive' } },
                  ],
                },
                ...(cityId ? [{ cityId }] : []),
              ],
            },
            select: {
              id: true,
              username: true,
              name: true,
              avatarUrl: true,
              bio: true,
            },
            take: 20,
          });

    const cafes =
      type === 'users'
        ? []
        : await this.prisma.cafe.findMany({
            where: {
              isVerified: true,
              name: { contains: query, mode: 'insensitive' },
              ...(cityId ? { cityId } : {}),
            },
            include: { photos: { take: 1 } },
            take: 20,
          });

    return { users, cafes };
  }
}
