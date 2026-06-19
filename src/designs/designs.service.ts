import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../super-admin/audit.service';
import {
  DEFAULT_DESIGN_KEY,
  DesignType,
  getDesign,
  isUsableDesign,
  listDesigns,
  RegisteredDesign,
} from './design-registry';

/** The resolved design pair a cafe actually renders with (after fallback). */
export interface ResolvedCafeDesigns {
  menu: ResolvedDesign;
  welcome: ResolvedDesign;
}

export interface ResolvedDesign {
  /** Key that should actually render (never null — falls back to default). */
  key: string;
  /** The key the cafe owner selected, if any (may differ after fallback). */
  selectedKey: string | null;
  /** True when `key` was forced to the default because the selection was
   * missing, disabled, or no longer accessible to this cafe. */
  fellBack: boolean;
}

@Injectable()
export class DesignsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ---------- Registry (code source of truth) ----------

  /** Every registered design (admin view — includes disabled ones). */
  listAll(type?: DesignType) {
    return listDesigns(type);
  }

  private requireDesign(key: string): RegisteredDesign {
    const d = getDesign(key);
    if (!d) throw new NotFoundException(`Unknown design "${key}"`);
    return d;
  }

  // ---------- Layer 2: admin access control ----------

  /** Cafes currently whitelisted for a design. */
  async listAccess(designKey: string) {
    this.requireDesign(designKey);
    const rows = await this.prisma.designCafeAccess.findMany({
      where: { designKey },
      orderBy: { createdAt: 'desc' },
      include: { cafe: { select: { id: true, name: true, slug: true } } },
    });
    return rows.map((r) => ({
      cafeId: r.cafeId,
      name: r.cafe.name,
      slug: r.cafe.slug,
      grantedAt: r.createdAt,
    }));
  }

  /** Whitelist one or more cafes for a design. Unknown cafe ids are ignored. */
  async grantAccess(actorId: string, designKey: string, cafeIds: string[]) {
    this.requireDesign(designKey);
    for (const cafeId of cafeIds) {
      await this.prisma.designCafeAccess
        .upsert({
          where: { designKey_cafeId: { designKey, cafeId } },
          create: { designKey, cafeId, grantedById: actorId },
          update: {},
        })
        .catch(() => undefined);
    }
    await this.audit.log(actorId, 'design.grant', 'design', designKey, {
      cafeIds,
    });
    return this.listAccess(designKey);
  }

  /**
   * Revoke a cafe's access to a design. We intentionally DO NOT clear the
   * cafe's stored selection — the public render falls back automatically
   * (see resolveCafeDesigns), so if access is granted again the cafe's
   * original choice comes back. Nothing destructive happens on revoke.
   */
  async revokeAccess(actorId: string, designKey: string, cafeId: string) {
    await this.prisma.designCafeAccess
      .delete({ where: { designKey_cafeId: { designKey, cafeId } } })
      .catch(() => undefined);
    await this.audit.log(actorId, 'design.revoke', 'design', designKey, {
      cafeId,
    });
    return this.listAccess(designKey);
  }

  // ---------- Shared: designs available to a cafe ----------

  /**
   * THE single source of truth for "which designs may this cafe use".
   * Both the cafe panel and the public render go through here, so access
   * rules can never diverge between them.
   *
   * A design is available to a cafe when it is enabled AND either:
   *   - it is a default design (always available as a safe fallback), or
   *   - the admin has whitelisted this cafe for it.
   */
  async availableDesignKeys(cafeId: string): Promise<Set<string>> {
    const granted = await this.prisma.designCafeAccess.findMany({
      where: { cafeId },
      select: { designKey: true },
    });
    const keys = new Set<string>(granted.map((g) => g.designKey));
    // Defaults are always available.
    for (const k of Object.values(DEFAULT_DESIGN_KEY)) keys.add(k);
    // Only keep keys that are still registered + enabled.
    return new Set([...keys].filter((k) => isUsableDesign(k)));
  }

  /** Available designs (full metadata) for the cafe panel, split by type. */
  async availableForCafe(cafeId: string) {
    const allowed = await this.availableDesignKeys(cafeId);
    const usable = listDesigns().filter(
      (d) => d.enabled && allowed.has(d.key),
    );
    const selection = await this.getSelection(cafeId);
    return {
      menu: usable.filter((d) => d.type === 'menu'),
      welcome: usable.filter((d) => d.type === 'welcome'),
      selection,
    };
  }

  // ---------- Layer 3: cafe owner selection ----------

  private async getSelection(cafeId: string) {
    const menu = await this.prisma.cafeMenu.findUnique({
      where: { cafeId },
      select: {
        selectedMenuDesignKey: true,
        selectedWelcomeDesignKey: true,
      },
    });
    const resolved = await this.resolveCafeDesigns(cafeId);
    return {
      selectedMenuDesignKey: menu?.selectedMenuDesignKey ?? null,
      selectedWelcomeDesignKey: menu?.selectedWelcomeDesignKey ?? null,
      resolved,
    };
  }

  /**
   * Persist the cafe owner's design choice. Each type is optional; passing
   * `null` resets to the default. A non-null choice must be a design the cafe
   * is actually allowed to use, else we reject — owners can't pick something
   * the admin hasn't granted.
   */
  async setSelection(
    cafeId: string,
    input: { menuDesignKey?: string | null; welcomeDesignKey?: string | null },
  ) {
    const allowed = await this.availableDesignKeys(cafeId);

    const data: {
      selectedMenuDesignKey?: string | null;
      selectedWelcomeDesignKey?: string | null;
    } = {};

    if (input.menuDesignKey !== undefined) {
      data.selectedMenuDesignKey = this.validateChoice(
        input.menuDesignKey,
        'menu',
        allowed,
      );
    }
    if (input.welcomeDesignKey !== undefined) {
      data.selectedWelcomeDesignKey = this.validateChoice(
        input.welcomeDesignKey,
        'welcome',
        allowed,
      );
    }

    // A cafe that hasn't opened the menu builder yet has no CafeMenu row. The
    // design picker can run before that, so create the row on first selection
    // (mirrors the default menu the public/owner endpoints synthesize).
    const existing = await this.prisma.cafeMenu.findUnique({
      where: { cafeId },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.cafeMenu.update({ where: { cafeId }, data });
    } else {
      await this.prisma.cafeMenu.create({
        data: {
          cafeId,
          slug: await this.freshMenuSlug(cafeId),
          selectedMenuDesignKey: data.selectedMenuDesignKey ?? null,
          selectedWelcomeDesignKey: data.selectedWelcomeDesignKey ?? null,
        },
      });
    }
    return this.getSelection(cafeId);
  }

  /** Generate a unique CafeMenu.slug from the cafe name. */
  private async freshMenuSlug(cafeId: string): Promise<string> {
    const cafe = await this.prisma.cafe.findUnique({
      where: { id: cafeId },
      select: { name: true },
    });
    const base =
      (cafe?.name ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48) || 'my-cafe-menu';
    let slug = base;
    let n = 1;
    while (await this.prisma.cafeMenu.findUnique({ where: { slug } })) {
      slug = `${base}-${n++}`;
    }
    return slug;
  }

  private validateChoice(
    key: string | null,
    type: DesignType,
    allowed: Set<string>,
  ): string | null {
    if (key === null) return null;
    const design = getDesign(key);
    if (!design || design.type !== type || !design.enabled) {
      throw new NotFoundException(`Unknown ${type} design "${key}"`);
    }
    if (!allowed.has(key)) {
      throw new NotFoundException(
        `Design "${key}" is not available to this cafe`,
      );
    }
    return key;
  }

  // ---------- Shared: render-time resolution with fallback ----------

  /**
   * Resolve which design keys a cafe should render with RIGHT NOW. Used by the
   * cafe panel and the public menu endpoint alike. Whenever a stored selection
   * is missing, disabled, or no longer accessible, it falls back to the
   * default design WITHOUT mutating the stored selection — so a later re-grant
   * silently restores the owner's original choice.
   */
  async resolveCafeDesigns(cafeId: string): Promise<ResolvedCafeDesigns> {
    const [menu, allowed] = await Promise.all([
      this.prisma.cafeMenu.findUnique({
        where: { cafeId },
        select: {
          selectedMenuDesignKey: true,
          selectedWelcomeDesignKey: true,
        },
      }),
      this.availableDesignKeys(cafeId),
    ]);

    return {
      menu: this.resolveOne(menu?.selectedMenuDesignKey ?? null, 'menu', allowed),
      welcome: this.resolveOne(
        menu?.selectedWelcomeDesignKey ?? null,
        'welcome',
        allowed,
      ),
    };
  }

  private resolveOne(
    selectedKey: string | null,
    type: DesignType,
    allowed: Set<string>,
  ): ResolvedDesign {
    const ok =
      !!selectedKey &&
      isUsableDesign(selectedKey) &&
      getDesign(selectedKey)?.type === type &&
      allowed.has(selectedKey);
    return {
      key: ok ? (selectedKey as string) : DEFAULT_DESIGN_KEY[type],
      selectedKey,
      fellBack: !ok,
    };
  }
}
