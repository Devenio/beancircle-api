import { Injectable, NotFoundException } from '@nestjs/common';
import { MenuTheme, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import { ApplyTemplateDto, UpsertTemplateDto } from './dto/super-admin.dto';

/** A single menu item parsed from a template file. */
export type FileTemplateItem = {
  name: string;
  description?: string | null;
  price: number;
  discountPrice?: number | null;
  calories?: number | null;
  ingredients?: string[];
  allergens?: string[];
  prepTimeMin?: number | null;
  imageUrl?: string | null;
  images?: string[];
  videoUrl?: string | null;
  isAvailable?: boolean;
  order?: number;
};

export type FileTemplateCategory = {
  name: string;
  order?: number;
  items?: FileTemplateItem[];
};

/** A normalized, validated template parsed from a file on disk. */
export type FileTemplateInput = {
  key: string;
  name: string;
  description?: string | null;
  previewImageUrl?: string | null;
  welcomeTitle?: string | null;
  welcomeMessage?: string | null;
  accentColor?: string;
  theme?: MenuTheme;
  themeConfig?: unknown;
  categories?: FileTemplateCategory[];
};

const templateInclude = {
  categories: {
    orderBy: { order: 'asc' as const },
    include: { items: { orderBy: { order: 'asc' as const } } },
  },
} satisfies Prisma.MenuTemplateInclude;

@Injectable()
export class MenuTemplatesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  list() {
    return this.prisma.menuTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { categories: true, assignments: true } },
      },
    });
  }

  async get(id: string) {
    const tpl = await this.prisma.menuTemplate.findUnique({
      where: { id },
      include: templateInclude,
    });
    if (!tpl) throw new NotFoundException('Template not found');
    return tpl;
  }

  /** Create or fully replace a template (categories + items) in one shot. */
  async upsert(actorId: string, dto: UpsertTemplateDto, id?: string) {
    const base = {
      name: dto.name,
      description: dto.description ?? null,
      previewImageUrl: dto.previewImageUrl ?? null,
      welcomeTitle: dto.welcomeTitle ?? null,
      welcomeMessage: dto.welcomeMessage ?? null,
      accentColor: dto.accentColor ?? '#2C1810',
      theme: dto.theme ?? undefined,
      themeConfig: (dto.themeConfig ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const tpl = id
        ? await tx.menuTemplate.update({ where: { id }, data: base })
        : await tx.menuTemplate.create({
            data: { ...base, createdById: actorId },
          });

      if (dto.categories) {
        await this.replaceCategories(tx, tpl.id, dto.categories);
      }

      return tx.menuTemplate.findUniqueOrThrow({
        where: { id: tpl.id },
        include: templateInclude,
      });
    });

    await this.audit.log(
      actorId,
      id ? 'menuTemplate.update' : 'menuTemplate.create',
      'menuTemplate',
      result.id,
    );
    return result;
  }

  /**
   * Import a template parsed from a file dropped in the project directory.
   * Keyed by `sourceKey` so re-importing the same file updates it in place
   * instead of creating duplicates. Marks the template as `source: 'file'`.
   */
  async importFromFile(actorId: string, file: FileTemplateInput) {
    const base = {
      name: file.name,
      description: file.description ?? null,
      previewImageUrl: file.previewImageUrl ?? null,
      welcomeTitle: file.welcomeTitle ?? null,
      welcomeMessage: file.welcomeMessage ?? null,
      accentColor: file.accentColor ?? '#2C1810',
      theme: file.theme ?? undefined,
      themeConfig: (file.themeConfig ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      source: 'file',
    };

    const existing = await this.prisma.menuTemplate.findUnique({
      where: { sourceKey: file.key },
      select: { id: true },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const tpl = existing
        ? await tx.menuTemplate.update({ where: { id: existing.id }, data: base })
        : await tx.menuTemplate.create({
            data: { ...base, sourceKey: file.key, createdById: actorId },
          });
      await this.replaceCategories(tx, tpl.id, file.categories ?? []);
      return tx.menuTemplate.findUniqueOrThrow({
        where: { id: tpl.id },
        include: templateInclude,
      });
    });

    await this.audit.log(
      actorId,
      existing ? 'menuTemplate.fileReimport' : 'menuTemplate.fileImport',
      'menuTemplate',
      result.id,
      { sourceKey: file.key },
    );
    return result;
  }

  /** Delete every category of a template and recreate them from the input. */
  private async replaceCategories(
    tx: Prisma.TransactionClient,
    templateId: string,
    categories: FileTemplateCategory[],
  ) {
    await tx.menuTemplateCategory.deleteMany({ where: { templateId } });
    for (const [ci, cat] of categories.entries()) {
      const category = await tx.menuTemplateCategory.create({
        data: { templateId, name: cat.name, order: cat.order ?? ci },
      });
      if (cat.items?.length) {
        await tx.menuTemplateItem.createMany({
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
            isAvailable: item.isAvailable ?? true,
            order: item.order ?? ii,
          })),
        });
      }
    }
  }

  async remove(actorId: string, id: string) {
    await this.get(id);
    await this.prisma.menuTemplate.delete({ where: { id } });
    await this.audit.log(actorId, 'menuTemplate.delete', 'menuTemplate', id);
    return { deleted: true };
  }

  /**
   * Clone a template onto a cafe's live menu, replacing its current categories.
   * Creates the CafeMenu shell on first use with a unique slug.
   */
  async applyToCafe(
    actorId: string,
    cafeId: string,
    templateId: string,
    dto: ApplyTemplateDto,
  ) {
    const tpl = await this.get(templateId);
    const cafe = await this.prisma.cafe.findUnique({
      where: { id: cafeId },
      select: { id: true, name: true },
    });
    if (!cafe) throw new NotFoundException('Cafe not found');

    const existing = await this.prisma.cafeMenu.findUnique({
      where: { cafeId },
    });
    const slug =
      dto.slug?.trim().toLowerCase() ||
      existing?.slug ||
      (await this.availableSlug(this.slugify(cafe.name)));
    const includeContent = dto.includeContent ?? true;

    // Design that the cafe's live menu adopts from the template.
    const design = {
      accentColor: tpl.accentColor,
      theme: tpl.theme,
      themeConfig: (tpl.themeConfig ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      activeTemplateId: tpl.id,
      ...(tpl.welcomeTitle ? { welcomeTitle: tpl.welcomeTitle } : {}),
      ...(tpl.welcomeMessage ? { welcomeMessage: tpl.welcomeMessage } : {}),
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const menu = existing
        ? await tx.cafeMenu.update({
            where: { cafeId },
            data: {
              ...design,
              ...(dto.publish !== undefined ? { isPublished: dto.publish } : {}),
            },
          })
        : await tx.cafeMenu.create({
            data: {
              cafeId,
              slug,
              welcomeTitle: tpl.welcomeTitle ?? cafe.name,
              welcomeMessage: tpl.welcomeMessage ?? null,
              accentColor: tpl.accentColor,
              theme: tpl.theme,
              themeConfig: (tpl.themeConfig ?? undefined) as
                | Prisma.InputJsonValue
                | undefined,
              activeTemplateId: tpl.id,
              isPublished: dto.publish ?? false,
            },
          });

      // Applying a template implies the cafe is allowed to use it.
      await tx.menuTemplateAssignment.upsert({
        where: { templateId_cafeId: { templateId: tpl.id, cafeId } },
        create: { templateId: tpl.id, cafeId, assignedById: actorId },
        update: {},
      });

      if (includeContent) {
        await tx.menuCategory.deleteMany({ where: { menuId: menu.id } });
        for (const cat of tpl.categories) {
          const category = await tx.menuCategory.create({
            data: { menuId: menu.id, name: cat.name, order: cat.order },
          });
          if (cat.items.length) {
            await tx.menuItem.createMany({
              data: cat.items.map((item) => ({
                categoryId: category.id,
                name: item.name,
                description: item.description,
                price: item.price,
                discountPrice: item.discountPrice,
                calories: item.calories,
                ingredients: item.ingredients,
                allergens: item.allergens,
                prepTimeMin: item.prepTimeMin,
                imageUrl: item.imageUrl,
                images: item.images,
                videoUrl: item.videoUrl,
                isAvailable: item.isAvailable,
                order: item.order,
              })),
            });
          }
        }
      }

      return menu;
    });

    await this.audit.log(actorId, 'menuTemplate.apply', 'cafe', cafeId, {
      templateId,
      includeContent,
    });
    return result;
  }

  // ---------------- Assignment (WordPress-style availability) ----------------

  /** Assign a template to one or more cafes, granting them access to it. */
  async assign(actorId: string, templateId: string, cafeIds: string[]) {
    await this.get(templateId);
    for (const cafeId of cafeIds) {
      await this.prisma.menuTemplateAssignment
        .upsert({
          where: { templateId_cafeId: { templateId, cafeId } },
          create: { templateId, cafeId, assignedById: actorId },
          update: {},
        })
        .catch(() => undefined); // ignore unknown cafe ids
    }
    await this.audit.log(actorId, 'menuTemplate.assign', 'menuTemplate', templateId, {
      cafeIds,
    });
    return this.listAssignments(templateId);
  }

  async unassign(actorId: string, templateId: string, cafeId: string) {
    await this.prisma.menuTemplateAssignment
      .delete({ where: { templateId_cafeId: { templateId, cafeId } } })
      .catch(() => undefined);
    // If this template was active on that cafe's menu, detach it.
    await this.prisma.cafeMenu
      .updateMany({
        where: { cafeId, activeTemplateId: templateId },
        data: { activeTemplateId: null },
      })
      .catch(() => undefined);
    await this.audit.log(actorId, 'menuTemplate.unassign', 'menuTemplate', templateId, {
      cafeId,
    });
    return this.listAssignments(templateId);
  }

  /** Cafes a template is assigned to, marking which one has it active. */
  async listAssignments(templateId: string) {
    const rows = await this.prisma.menuTemplateAssignment.findMany({
      where: { templateId },
      orderBy: { createdAt: 'desc' },
      include: {
        cafe: {
          select: {
            id: true,
            name: true,
            slug: true,
            menu: { select: { activeTemplateId: true, isPublished: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      cafeId: r.cafeId,
      name: r.cafe.name,
      slug: r.cafe.slug,
      assignedAt: r.createdAt,
      active: r.cafe.menu?.activeTemplateId === templateId,
      published: r.cafe.menu?.isPublished ?? false,
    }));
  }

  /** Templates available to a cafe (for cafe-os theme switching). */
  async templatesForCafe(cafeId: string) {
    const rows = await this.prisma.menuTemplateAssignment.findMany({
      where: { cafeId },
      orderBy: { createdAt: 'desc' },
      include: { template: true },
    });
    return rows.map((r) => r.template);
  }

  private slugify(name: string) {
    return (
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'menu'
    );
  }

  private async availableSlug(base: string) {
    let slug = base;
    let n = 1;
    // Find an unused slug; CafeMenu.slug is unique.
    while (await this.prisma.cafeMenu.findUnique({ where: { slug } })) {
      slug = `${base}-${n++}`;
    }
    return slug;
  }
}
