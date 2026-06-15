import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  FEATURE_FLAGS,
  FeatureFlagDef,
  FeatureFlagKey,
} from './feature-flags.constants';

const GLOBAL_CACHE_KEY = 'feature-flags:global';
const cafeCacheKey = (cafeId: string) => `feature-flags:cafe:${cafeId}`;
const CACHE_TTL_SECONDS = 60;

export type FlagMap = Record<string, boolean>;

@Injectable()
export class FeatureFlagsService implements OnModuleInit {
  private readonly logger = new Logger(FeatureFlagsService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async onModuleInit() {
    await this.syncRegistry();
  }

  /** Upsert any registry flags that don't yet exist (keeps labels in sync). */
  async syncRegistry() {
    for (const def of FEATURE_FLAGS) {
      await this.prisma.featureFlag.upsert({
        where: { key: def.key },
        create: {
          key: def.key,
          label: def.label,
          description: def.description,
          category: def.category,
        },
        update: {
          label: def.label,
          description: def.description,
          category: def.category,
        },
      });
    }
    await this.invalidate();
    this.logger.log(`Synced ${FEATURE_FLAGS.length} feature flags`);
  }

  /** Effective global flag map (key -> enabled), Redis-cached. */
  async getGlobalMap(): Promise<FlagMap> {
    const cached = await this.safeGet(GLOBAL_CACHE_KEY);
    if (cached) return cached;
    const flags = await this.prisma.featureFlag.findMany();
    const map: FlagMap = {};
    for (const f of flags) map[f.key] = f.enabledGlobal;
    await this.safeSet(GLOBAL_CACHE_KEY, map);
    return map;
  }

  /** Effective flag map for a cafe = global defaults with cafe overrides applied. */
  async getEffective(cafeId?: string): Promise<FlagMap> {
    const global = await this.getGlobalMap();
    if (!cafeId) return global;

    const cached = await this.safeGet(cafeCacheKey(cafeId));
    if (cached) return cached;

    const overrides = await this.prisma.cafeFeatureFlag.findMany({
      where: { cafeId },
    });
    const map: FlagMap = { ...global };
    for (const o of overrides) map[o.flagKey] = o.enabled;
    await this.safeSet(cafeCacheKey(cafeId), map);
    return map;
  }

  async isEnabled(key: string, cafeId?: string): Promise<boolean> {
    const map = await this.getEffective(cafeId);
    // Unknown keys default to enabled so a missing flag never hard-blocks.
    return map[key] ?? true;
  }

  // ---------------- Admin mutations ----------------

  async setGlobal(key: string, enabled: boolean) {
    const flag = await this.prisma.featureFlag.update({
      where: { key },
      data: { enabledGlobal: enabled },
    });
    await this.invalidate();
    return flag;
  }

  /** Set (enabled true/false) or clear (null) a per-cafe override. */
  async setCafeOverride(cafeId: string, key: string, enabled: boolean | null) {
    if (enabled === null) {
      await this.prisma.cafeFeatureFlag
        .delete({ where: { cafeId_flagKey: { cafeId, flagKey: key } } })
        .catch(() => undefined);
    } else {
      await this.prisma.cafeFeatureFlag.upsert({
        where: { cafeId_flagKey: { cafeId, flagKey: key } },
        create: { cafeId, flagKey: key, enabled },
        update: { enabled },
      });
    }
    await this.invalidateCafe(cafeId);
    return this.getEffective(cafeId);
  }

  /** Full admin view: every registry flag with global value + cafe overrides. */
  async listForAdmin() {
    const [flags, overrides] = await Promise.all([
      this.prisma.featureFlag.findMany({ orderBy: [{ category: 'asc' }, { label: 'asc' }] }),
      this.prisma.cafeFeatureFlag.findMany({
        include: { cafe: { select: { id: true, name: true } } },
      }),
    ]);
    return flags.map((f) => ({
      ...f,
      overrides: overrides
        .filter((o) => o.flagKey === f.key)
        .map((o) => ({
          cafeId: o.cafeId,
          cafeName: o.cafe.name,
          enabled: o.enabled,
        })),
    }));
  }

  registry(): FeatureFlagDef[] {
    return FEATURE_FLAGS;
  }

  // ---------------- Cache helpers ----------------

  private async invalidate() {
    await this.safeDelPattern('feature-flags:*');
  }

  private async invalidateCafe(cafeId: string) {
    await this.redis.client.del(cafeCacheKey(cafeId)).catch(() => undefined);
  }

  private async safeGet(key: string): Promise<FlagMap | null> {
    try {
      const raw = await this.redis.client.get(key);
      return raw ? (JSON.parse(raw) as FlagMap) : null;
    } catch {
      return null;
    }
  }

  private async safeSet(key: string, value: FlagMap) {
    try {
      await this.redis.client.setex(
        key,
        CACHE_TTL_SECONDS,
        JSON.stringify(value),
      );
    } catch {
      // Cache is best-effort; ignore Redis failures.
    }
  }

  private async safeDelPattern(pattern: string) {
    try {
      const keys = await this.redis.client.keys(pattern);
      if (keys.length) await this.redis.client.del(...keys);
    } catch {
      // ignore
    }
  }
}

export type { FeatureFlagKey };
