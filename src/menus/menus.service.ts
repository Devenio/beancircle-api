import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as QRCode from 'qrcode';
import { CafeOsHooksService } from '../cafe-os/cafe-os-hooks.service';
import { OwnerService } from '../owner/owner.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCategoryDto,
  MenuItemFieldsDto,
  MenuSettingsDto,
  UpdateCategoryDto,
  UpdateMenuItemDto,
  UpsertMenuDto,
} from './dto/upsert-menu.dto';

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
      description: true,
      logoUrl: true,
      coverUrl: true,
      wifiName: true,
      wifiPassword: true,
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
    private hooks: CafeOsHooksService,
  ) {}

  // ---------- Public ----------

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

  /** Track a public QR scan, optionally attributed to a specific QR code. */
  async recordPublicScan(slug: string, code?: string, userId?: string) {
    const menu = await this.prisma.cafeMenu.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { cafeId: true, isPublished: true },
    });
    if (!menu || !menu.isPublished) {
      throw new NotFoundException('Menu not found');
    }

    let qrCodeId: string | null = null;
    if (code) {
      const qr = await this.prisma.qrCode.findUnique({
        where: { code },
        select: { id: true, cafeId: true },
      });
      if (qr && qr.cafeId === menu.cafeId) {
        qrCodeId = qr.id;
        await this.prisma.qrCode.update({
          where: { id: qr.id },
          data: { scanCount: { increment: 1 } },
        });
      }
    }

    await this.prisma.qrScan.create({
      data: { cafeId: menu.cafeId, qrCodeId, userId: userId ?? null },
    });
    await this.hooks.onScan(menu.cafeId, userId);
    return { ok: true };
  }

  /** Track an item detail view on the public menu (powers "popular items"). */
  async recordItemView(slug: string, itemId: string) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        category: {
          select: { menu: { select: { slug: true, isPublished: true } } },
        },
      },
    });
    if (
      !item ||
      !item.category.menu.isPublished ||
      item.category.menu.slug !== slug.toLowerCase()
    ) {
      throw new NotFoundException('Item not found');
    }
    await this.prisma.menuItem.update({
      where: { id: itemId },
      data: { viewCount: { increment: 1 } },
    });
    return { ok: true };
  }

  // ---------- Owner: full document (legacy editor) ----------

  async getOwnerMenu(userId: string, cafeId: string) {
    await this.owner.assertStaff(userId, cafeId);
    return this.getOrDefault(cafeId);
  }

  /** Menu for an already staff-authorized context (Cafe OS routes). */
  async getMenuForCafe(cafeId: string) {
    return this.getOrDefault(cafeId);
  }

  private async getOrDefault(cafeId: string) {
    const menu = await this.prisma.cafeMenu.findUnique({
      where: { cafeId },
      include: menuInclude,
    });
    if (menu) return menu;
    const cafe = await this.prisma.cafe.findUniqueOrThrow({
      where: { id: cafeId },
      select: { id: true, name: true, logoUrl: true },
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
      theme: 'MINIMAL',
      themeConfig: null,
      isPublished: false,
      categories: [],
      cafe: {
        id: cafe.id,
        name: cafe.name,
        address: '',
        logoUrl: cafe.logoUrl,
        photos: [],
      },
    };
  }

  async upsertMenu(userId: string, cafeId: string, dto: UpsertMenuDto) {
    await this.owner.assertOwner(userId, cafeId);
    const slug = dto.slug.trim().toLowerCase();
    const existing = await this.prisma.cafeMenu.findUnique({
      where: { cafeId },
    });
    if (!existing || existing.slug !== slug) {
      const taken = await this.prisma.cafeMenu.findUnique({ where: { slug } });
      if (taken && taken.cafeId !== cafeId) {
        throw new BadRequestException('This menu path is already taken');
      }
    }

    const baseData = {
      slug,
      welcomeTitle: dto.welcomeTitle ?? null,
      welcomeMessage: dto.welcomeMessage ?? null,
      welcomeImageUrl: dto.welcomeImageUrl ?? null,
      accentColor: dto.accentColor ?? '#2C1810',
      theme: dto.theme ?? undefined,
      themeConfig: (dto.themeConfig ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      isPublished: dto.isPublished ?? false,
    };

    return this.prisma.$transaction(async (tx) => {
      const menu = existing
        ? await tx.cafeMenu.update({ where: { cafeId }, data: baseData })
        : await tx.cafeMenu.create({ data: { cafeId, ...baseData } });

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
              discountPrice: item.discountPrice ?? null,
              calories: item.calories ?? null,
              ingredients: item.ingredients ?? [],
              allergens: item.allergens ?? [],
              prepTimeMin: item.prepTimeMin ?? null,
              imageUrl: item.imageUrl ?? null,
              images: item.images ?? [],
              videoUrl: item.videoUrl ?? null,
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

  // ---------- Cafe OS: granular editing ----------

  /** Create the menu shell on first use, update settings otherwise. */
  async updateSettings(cafeId: string, dto: MenuSettingsDto) {
    const existing = await this.prisma.cafeMenu.findUnique({
      where: { cafeId },
    });
    const slug = dto.slug?.trim().toLowerCase();
    if (slug && (!existing || existing.slug !== slug)) {
      const taken = await this.prisma.cafeMenu.findUnique({ where: { slug } });
      if (taken && taken.cafeId !== cafeId) {
        throw new BadRequestException('This menu path is already taken');
      }
    }

    const data = {
      ...(slug ? { slug } : {}),
      ...(dto.welcomeTitle !== undefined
        ? { welcomeTitle: dto.welcomeTitle }
        : {}),
      ...(dto.welcomeMessage !== undefined
        ? { welcomeMessage: dto.welcomeMessage }
        : {}),
      ...(dto.welcomeImageUrl !== undefined
        ? { welcomeImageUrl: dto.welcomeImageUrl }
        : {}),
      ...(dto.accentColor !== undefined
        ? { accentColor: dto.accentColor }
        : {}),
      ...(dto.theme !== undefined ? { theme: dto.theme } : {}),
      ...(dto.themeConfig !== undefined
        ? { themeConfig: dto.themeConfig as Prisma.InputJsonValue }
        : {}),
      ...(dto.isPublished !== undefined
        ? { isPublished: dto.isPublished }
        : {}),
    };

    if (existing) {
      await this.prisma.cafeMenu.update({ where: { cafeId }, data });
    } else {
      const cafe = await this.prisma.cafe.findUniqueOrThrow({
        where: { id: cafeId },
        select: { name: true },
      });
      await this.prisma.cafeMenu.create({
        data: {
          cafeId,
          slug: slug ?? (await this.availableSlug(this.suggestSlug(cafe.name))),
          ...data,
        },
      });
    }
    return this.getOrDefault(cafeId);
  }

  private async requireMenu(cafeId: string) {
    const menu = await this.prisma.cafeMenu.findUnique({ where: { cafeId } });
    if (!menu) throw new NotFoundException('Save your menu settings first');
    return menu;
  }

  async createCategory(cafeId: string, dto: CreateCategoryDto) {
    const menu = await this.requireMenu(cafeId);
    const count = await this.prisma.menuCategory.count({
      where: { menuId: menu.id },
    });
    return this.prisma.menuCategory.create({
      data: { menuId: menu.id, name: dto.name, order: count },
      include: { items: true },
    });
  }

  async updateCategory(
    cafeId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
  ) {
    await this.requireCategory(cafeId, categoryId);
    return this.prisma.menuCategory.update({
      where: { id: categoryId },
      data: { name: dto.name },
      include: { items: { orderBy: { order: 'asc' } } },
    });
  }

  async deleteCategory(cafeId: string, categoryId: string) {
    await this.requireCategory(cafeId, categoryId);
    await this.prisma.menuCategory.delete({ where: { id: categoryId } });
    return { deleted: true };
  }

  async reorderCategories(cafeId: string, ids: string[]) {
    const menu = await this.requireMenu(cafeId);
    await this.prisma.$transaction(
      ids.map((id, i) =>
        this.prisma.menuCategory.updateMany({
          where: { id, menuId: menu.id },
          data: { order: i },
        }),
      ),
    );
    return this.getOrDefault(cafeId);
  }

  async createItem(
    cafeId: string,
    categoryId: string,
    dto: MenuItemFieldsDto,
  ) {
    await this.requireCategory(cafeId, categoryId);
    const count = await this.prisma.menuItem.count({ where: { categoryId } });
    return this.prisma.menuItem.create({
      data: {
        categoryId,
        name: dto.name,
        description: dto.description ?? null,
        price: dto.price,
        discountPrice: dto.discountPrice ?? null,
        calories: dto.calories ?? null,
        ingredients: dto.ingredients ?? [],
        allergens: dto.allergens ?? [],
        prepTimeMin: dto.prepTimeMin ?? null,
        imageUrl: dto.imageUrl ?? null,
        images: dto.images ?? [],
        videoUrl: dto.videoUrl ?? null,
        isAvailable: dto.isAvailable ?? true,
        order: count,
      },
    });
  }

  async updateItem(cafeId: string, itemId: string, dto: UpdateMenuItemDto) {
    await this.requireItem(cafeId, itemId);
    return this.prisma.menuItem.update({
      where: { id: itemId },
      data: dto,
    });
  }

  async deleteItem(cafeId: string, itemId: string) {
    await this.requireItem(cafeId, itemId);
    await this.prisma.menuItem.delete({ where: { id: itemId } });
    return { deleted: true };
  }

  async reorderItems(cafeId: string, categoryId: string, ids: string[]) {
    await this.requireCategory(cafeId, categoryId);
    await this.prisma.$transaction(
      ids.map((id, i) =>
        this.prisma.menuItem.updateMany({
          where: { id, categoryId },
          data: { order: i },
        }),
      ),
    );
    return this.prisma.menuItem.findMany({
      where: { categoryId },
      orderBy: { order: 'asc' },
    });
  }

  // ---------- QR (legacy owner endpoint) ----------

  async getQrCode(userId: string, cafeId: string, locale = 'en') {
    await this.owner.assertStaff(userId, cafeId);
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

  // ---------- Helpers ----------

  private async requireCategory(cafeId: string, categoryId: string) {
    const category = await this.prisma.menuCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, menu: { select: { cafeId: true } } },
    });
    if (!category || category.menu.cafeId !== cafeId) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  private async requireItem(cafeId: string, itemId: string) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        category: { select: { menu: { select: { cafeId: true } } } },
      },
    });
    if (!item || item.category.menu.cafeId !== cafeId) {
      throw new NotFoundException('Item not found');
    }
    return item;
  }

  private async availableSlug(base: string) {
    let slug = base;
    for (let i = 0; i < 50; i += 1) {
      const taken = await this.prisma.cafeMenu.findUnique({ where: { slug } });
      if (!taken) return slug;
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
    return `${base}-${Date.now().toString(36)}`;
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
