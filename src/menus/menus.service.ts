import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import { OwnerService } from '../owner/owner.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertMenuDto } from './dto/upsert-menu.dto';

const menuInclude = {
  categories: {
    orderBy: { order: 'asc' as const },
    include: {
      items: { orderBy: { order: 'asc' as const } },
    },
  },
  cafe: {
    select: {
      id: true,
      name: true,
      address: true,
      photos: { take: 1, orderBy: { order: 'asc' as const } },
    },
  },
};

@Injectable()
export class MenusService {
  constructor(
    private prisma: PrismaService,
    private owner: OwnerService,
    private config: ConfigService,
  ) {}

  async getPublicBySlug(slug: string) {
    const menu = await this.prisma.cafeMenu.findUnique({
      where: { slug: slug.toLowerCase() },
      include: menuInclude,
    });
    if (!menu || !menu.isPublished) {
      throw new NotFoundException('Menu not found');
    }
    return menu;
  }

  async getOwnerMenu(userId: string, cafeId: string) {
    await this.owner.assertOwner(userId, cafeId);
    const menu = await this.prisma.cafeMenu.findUnique({
      where: { cafeId },
      include: menuInclude,
    });
    if (menu) return menu;
    const cafe = await this.prisma.cafe.findUniqueOrThrow({
      where: { id: cafeId },
      select: { id: true, name: true },
    });
    const slug = this.suggestSlug(cafe.name);
    return {
      id: null,
      cafeId,
      slug,
      welcomeTitle: cafe.name,
      welcomeMessage: null,
      welcomeImageUrl: null,
      accentColor: '#2C1810',
      isPublished: false,
      categories: [],
      cafe: { id: cafe.id, name: cafe.name, address: '', photos: [] },
    };
  }

  async upsertMenu(userId: string, cafeId: string, dto: UpsertMenuDto) {
    await this.owner.assertOwner(userId, cafeId);
    const slug = dto.slug.trim().toLowerCase();
    const existing = await this.prisma.cafeMenu.findUnique({
      where: { cafeId },
    });
    if (existing && existing.slug !== slug) {
      const taken = await this.prisma.cafeMenu.findUnique({ where: { slug } });
      if (taken) {
        throw new BadRequestException('This menu path is already taken');
      }
    }
    if (!existing) {
      const taken = await this.prisma.cafeMenu.findUnique({ where: { slug } });
      if (taken) {
        throw new BadRequestException('This menu path is already taken');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const menu = existing
        ? await tx.cafeMenu.update({
            where: { cafeId },
            data: {
              slug,
              welcomeTitle: dto.welcomeTitle ?? null,
              welcomeMessage: dto.welcomeMessage ?? null,
              welcomeImageUrl: dto.welcomeImageUrl ?? null,
              accentColor: dto.accentColor ?? '#2C1810',
              isPublished: dto.isPublished ?? false,
            },
          })
        : await tx.cafeMenu.create({
            data: {
              cafeId,
              slug,
              welcomeTitle: dto.welcomeTitle ?? null,
              welcomeMessage: dto.welcomeMessage ?? null,
              welcomeImageUrl: dto.welcomeImageUrl ?? null,
              accentColor: dto.accentColor ?? '#2C1810',
              isPublished: dto.isPublished ?? false,
            },
          });

      await tx.menuCategory.deleteMany({ where: { menuId: menu.id } });

      for (const [ci, cat] of dto.categories.entries()) {
        const category = await tx.menuCategory.create({
          data: {
            menuId: menu.id,
            name: cat.name,
            order: cat.order ?? ci,
          },
        });
        if (cat.items?.length) {
          await tx.menuItem.createMany({
            data: cat.items.map((item, ii) => ({
              categoryId: category.id,
              name: item.name,
              description: item.description ?? null,
              price: item.price,
              imageUrl: item.imageUrl ?? null,
              order: item.order ?? ii,
              isAvailable: item.isAvailable ?? true,
            })),
          });
        }
      }

      return tx.cafeMenu.findUniqueOrThrow({
        where: { id: menu.id },
        include: menuInclude,
      });
    });
  }

  async getQrCode(userId: string, cafeId: string, locale = 'en') {
    await this.owner.assertOwner(userId, cafeId);
    const menu = await this.prisma.cafeMenu.findUnique({ where: { cafeId } });
    if (!menu) {
      throw new NotFoundException('Create and save your menu first');
    }
    const front = this.config.get('FRONTEND_URL') ?? 'http://localhost:3000';
    const menuUrl = `${front}/${locale}/m/${menu.slug}`;
    const qrDataUrl = await QRCode.toDataURL(menuUrl, {
      margin: 2,
      width: 512,
      color: { dark: menu.accentColor, light: '#FFFFFF' },
    });
    return { menuUrl, qrDataUrl, slug: menu.slug, isPublished: menu.isPublished };
  }

  private suggestSlug(name: string) {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    return base || 'my-cafe-menu';
  }
}
