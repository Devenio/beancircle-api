import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MenuTheme } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  FileTemplateCategory,
  FileTemplateInput,
  FileTemplateItem,
  MenuTemplatesService,
} from './menu-templates.service';

/** A discovered file, with parse status and whether it's been imported. */
export type FileTemplateSummary = {
  key: string;
  file: string;
  valid: boolean;
  error: string | null;
  name: string | null;
  description: string | null;
  theme: MenuTheme | null;
  accentColor: string | null;
  categoryCount: number;
  itemCount: number;
  fileUpdatedAt: string;
  imported: boolean;
  importedId: string | null;
  importedAt: string | null;
  /** True when the file changed on disk after the last import. */
  stale: boolean;
};

const VALID_THEMES = new Set<string>(Object.values(MenuTheme));
const KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

@Injectable()
export class MenuFileTemplatesService {
  constructor(
    private prisma: PrismaService,
    private templates: MenuTemplatesService,
  ) {}

  /** Absolute path to the drop-in templates folder. */
  private dir() {
    return (
      process.env.MENU_TEMPLATES_DIR?.trim() ||
      path.join(process.cwd(), 'menu-templates')
    );
  }

  /** List every `*.json` file in the folder with parse status + import state. */
  async list(): Promise<FileTemplateSummary[]> {
    const dir = this.dir();
    let names: string[] = [];
    try {
      names = (await fs.readdir(dir))
        .filter((n) => n.toLowerCase().endsWith('.json'))
        .filter((n) => !n.startsWith('_') && !n.startsWith('.'))
        .sort();
    } catch {
      // Folder doesn't exist yet — that's fine, return nothing.
      return [];
    }

    // Cross-reference already-imported file templates.
    const imported = await this.prisma.menuTemplate.findMany({
      where: { source: 'file', sourceKey: { not: null } },
      select: { id: true, sourceKey: true, updatedAt: true },
    });
    const byKey = new Map(imported.map((t) => [t.sourceKey as string, t]));

    const out: FileTemplateSummary[] = [];
    for (const file of names) {
      const key = this.keyOf(file);
      const full = path.join(dir, file);
      let stat: { mtime: Date } | null = null;
      try {
        stat = await fs.stat(full);
      } catch {
        continue;
      }
      const fileUpdatedAt = stat.mtime.toISOString();
      const row = byKey.get(key);
      const base = {
        key,
        file,
        fileUpdatedAt,
        imported: !!row,
        importedId: row?.id ?? null,
        importedAt: row?.updatedAt.toISOString() ?? null,
        stale: row ? stat.mtime > row.updatedAt : false,
      };
      try {
        const parsed = await this.readAndParse(file);
        const itemCount = (parsed.categories ?? []).reduce(
          (s, c) => s + (c.items?.length ?? 0),
          0,
        );
        out.push({
          ...base,
          valid: true,
          error: null,
          name: parsed.name,
          description: parsed.description ?? null,
          theme: parsed.theme ?? MenuTheme.MINIMAL,
          accentColor: parsed.accentColor ?? null,
          categoryCount: parsed.categories?.length ?? 0,
          itemCount,
        });
      } catch (e) {
        out.push({
          ...base,
          valid: false,
          error: e instanceof Error ? e.message : 'Failed to parse',
          name: null,
          description: null,
          theme: null,
          accentColor: null,
          categoryCount: 0,
          itemCount: 0,
        });
      }
    }
    return out;
  }

  /** Parse and return one file (for preview), throwing if invalid. */
  async getOne(key: string): Promise<FileTemplateInput> {
    return this.readAndParse(this.fileFor(key));
  }

  /** Import a single file into the DB as a reusable template. */
  async import(actorId: string, key: string) {
    const parsed = await this.readAndParse(this.fileFor(key));
    return this.templates.importFromFile(actorId, parsed);
  }

  /** Import every valid file in the folder; returns a per-file result. */
  async importAll(actorId: string) {
    const files = await this.list();
    const results: {
      key: string;
      ok: boolean;
      id?: string;
      error?: string;
    }[] = [];
    for (const f of files) {
      if (!f.valid) {
        results.push({ key: f.key, ok: false, error: f.error ?? 'invalid' });
        continue;
      }
      try {
        const tpl = await this.import(actorId, f.key);
        results.push({ key: f.key, ok: true, id: tpl.id });
      } catch (e) {
        results.push({
          key: f.key,
          ok: false,
          error: e instanceof Error ? e.message : 'failed',
        });
      }
    }
    return results;
  }

  /** Import a file and immediately assign the resulting template to cafes. */
  async importAndAssign(actorId: string, key: string, cafeIds: string[]) {
    const tpl = await this.import(actorId, key);
    const assignments = await this.templates.assign(actorId, tpl.id, cafeIds);
    return { template: tpl, assignments };
  }

  // ---------------- internals ----------------

  private keyOf(file: string) {
    return file.replace(/\.json$/i, '');
  }

  /** Resolve a user-supplied key to a safe file name inside the folder. */
  private fileFor(key: string) {
    if (!KEY_RE.test(key)) {
      throw new BadRequestException('Invalid template key');
    }
    const dir = this.dir();
    const full = path.join(dir, `${key}.json`);
    // Defense in depth against path traversal.
    if (path.dirname(full) !== path.resolve(dir)) {
      throw new BadRequestException('Invalid template key');
    }
    return `${key}.json`;
  }

  private async readAndParse(file: string): Promise<FileTemplateInput> {
    const full = path.join(this.dir(), file);
    let raw: string;
    try {
      raw = await fs.readFile(full, 'utf8');
    } catch {
      throw new NotFoundException(`Template file not found: ${file}`);
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      throw new BadRequestException(
        `Invalid JSON: ${e instanceof Error ? e.message : 'parse error'}`,
      );
    }
    return this.normalize(json, this.keyOf(file));
  }

  /** Validate + normalize a parsed JSON object into a FileTemplateInput. */
  private normalize(raw: unknown, fileKey: string): FileTemplateInput {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BadRequestException('Template must be a JSON object');
    }
    const o = raw as Record<string, unknown>;

    const key = typeof o.key === 'string' && o.key.trim() ? o.key.trim() : fileKey;
    if (!KEY_RE.test(key)) {
      throw new BadRequestException(
        '`key` must be alphanumeric with dashes/underscores',
      );
    }

    if (typeof o.name !== 'string' || !o.name.trim()) {
      throw new BadRequestException('`name` is required');
    }

    let theme: MenuTheme | undefined;
    if (o.theme != null) {
      const t = String(o.theme).toUpperCase();
      if (!VALID_THEMES.has(t)) {
        throw new BadRequestException(
          `Unknown theme "${String(o.theme)}". Allowed: ${[...VALID_THEMES].join(', ')}`,
        );
      }
      theme = t as MenuTheme;
    }

    if (o.accentColor != null && typeof o.accentColor !== 'string') {
      throw new BadRequestException('`accentColor` must be a string');
    }

    const categories = this.normalizeCategories(o.categories);

    return {
      key,
      name: o.name.trim(),
      description: this.optStr(o.description, 'description'),
      previewImageUrl: this.optStr(o.previewImageUrl, 'previewImageUrl'),
      welcomeTitle: this.optStr(o.welcomeTitle, 'welcomeTitle'),
      welcomeMessage: this.optStr(o.welcomeMessage, 'welcomeMessage'),
      accentColor: (o.accentColor as string | undefined) ?? undefined,
      theme,
      themeConfig:
        o.themeConfig && typeof o.themeConfig === 'object'
          ? o.themeConfig
          : undefined,
      categories,
    };
  }

  private normalizeCategories(raw: unknown): FileTemplateCategory[] {
    if (raw == null) return [];
    if (!Array.isArray(raw)) {
      throw new BadRequestException('`categories` must be an array');
    }
    return raw.map((c, ci) => {
      if (!c || typeof c !== 'object') {
        throw new BadRequestException(`Category #${ci + 1} must be an object`);
      }
      const co = c as Record<string, unknown>;
      if (typeof co.name !== 'string' || !co.name.trim()) {
        throw new BadRequestException(`Category #${ci + 1} needs a name`);
      }
      return {
        name: co.name.trim(),
        order: this.optInt(co.order, `category "${co.name}" order`),
        items: this.normalizeItems(co.items, co.name as string),
      };
    });
  }

  private normalizeItems(raw: unknown, catName: string): FileTemplateItem[] {
    if (raw == null) return [];
    if (!Array.isArray(raw)) {
      throw new BadRequestException(`Items of "${catName}" must be an array`);
    }
    return raw.map((it, ii) => {
      if (!it || typeof it !== 'object') {
        throw new BadRequestException(
          `Item #${ii + 1} in "${catName}" must be an object`,
        );
      }
      const io = it as Record<string, unknown>;
      const label = `item #${ii + 1} in "${catName}"`;
      if (typeof io.name !== 'string' || !io.name.trim()) {
        throw new BadRequestException(`${label} needs a name`);
      }
      const price = this.requireInt(io.price, `${label} price`);
      return {
        name: io.name.trim(),
        description: this.optStr(io.description, `${label} description`),
        price,
        discountPrice: this.optInt(io.discountPrice, `${label} discountPrice`),
        calories: this.optInt(io.calories, `${label} calories`),
        ingredients: this.optStrArr(io.ingredients, `${label} ingredients`),
        allergens: this.optStrArr(io.allergens, `${label} allergens`),
        prepTimeMin: this.optInt(io.prepTimeMin, `${label} prepTimeMin`),
        imageUrl: this.optStr(io.imageUrl, `${label} imageUrl`),
        images: this.optStrArr(io.images, `${label} images`),
        videoUrl: this.optStr(io.videoUrl, `${label} videoUrl`),
        isAvailable:
          io.isAvailable == null ? undefined : Boolean(io.isAvailable),
        order: this.optInt(io.order, `${label} order`),
      };
    });
  }

  private optStr(v: unknown, field: string): string | undefined {
    if (v == null) return undefined;
    if (typeof v !== 'string') {
      throw new BadRequestException(`\`${field}\` must be a string`);
    }
    return v;
  }

  private optStrArr(v: unknown, field: string): string[] | undefined {
    if (v == null) return undefined;
    if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
      throw new BadRequestException(`\`${field}\` must be an array of strings`);
    }
    return v as string[];
  }

  private requireInt(v: unknown, field: string): number {
    const n = this.optInt(v, field);
    if (n == null) throw new BadRequestException(`\`${field}\` is required`);
    return n;
  }

  private optInt(v: unknown, field: string): number | undefined {
    if (v == null) return undefined;
    if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v)) {
      throw new BadRequestException(`\`${field}\` must be an integer`);
    }
    if (v < 0) throw new BadRequestException(`\`${field}\` must be >= 0`);
    return v;
  }
}
