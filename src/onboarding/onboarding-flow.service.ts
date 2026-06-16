import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ONBOARDING_FLOW_STEPS } from './onboarding-flow.constants';

const FLOW_CACHE_KEY = 'onboarding:flow:active';
const CACHE_TTL_SECONDS = 60;

export type ActiveFlowStep = { key: string; label: string };

@Injectable()
export class OnboardingFlowService implements OnModuleInit {
  private readonly logger = new Logger(OnboardingFlowService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async onModuleInit() {
    await this.syncRegistry();
  }

  /**
   * Upsert any registry steps that don't yet exist. Only `label`/`description`
   * are refreshed on update so admin edits to `enabled`/`order` survive boots.
   */
  async syncRegistry() {
    for (const def of ONBOARDING_FLOW_STEPS) {
      await this.prisma.onboardingStepConfig.upsert({
        where: { key: def.key },
        create: {
          key: def.key,
          label: def.label,
          description: def.description,
          order: def.order,
        },
        update: { label: def.label, description: def.description },
      });
    }
    await this.invalidate();
    this.logger.log(`Synced ${ONBOARDING_FLOW_STEPS.length} onboarding steps`);
  }

  /** Ordered keys of the enabled steps — what the client renders. Redis-cached. */
  async getActiveFlow(): Promise<string[]> {
    const cached = await this.safeGet(FLOW_CACHE_KEY);
    if (cached) return cached;
    const steps = await this.prisma.onboardingStepConfig.findMany({
      where: { enabled: true },
      orderBy: { order: 'asc' },
      select: { key: true },
    });
    const keys = steps.map((s) => s.key);
    await this.safeSet(FLOW_CACHE_KEY, keys);
    return keys;
  }

  /** Full admin view: every step (enabled + disabled) in display order. */
  listForAdmin() {
    return this.prisma.onboardingStepConfig.findMany({
      orderBy: { order: 'asc' },
    });
  }

  async setStep(key: string, enabled: boolean) {
    const step = await this.prisma.onboardingStepConfig.update({
      where: { key },
      data: { enabled },
    });
    await this.invalidate();
    return step;
  }

  /** Persist a new ordering; `order` becomes the index of each key in `keys`. */
  async reorder(keys: string[]) {
    await this.prisma.$transaction(
      keys.map((key, index) =>
        this.prisma.onboardingStepConfig.update({
          where: { key },
          data: { order: index },
        }),
      ),
    );
    await this.invalidate();
    return this.listForAdmin();
  }

  // ---------------- Cache helpers ----------------

  private async invalidate() {
    await this.redis.client.del(FLOW_CACHE_KEY).catch(() => undefined);
  }

  private async safeGet(key: string): Promise<string[] | null> {
    try {
      const raw = await this.redis.client.get(key);
      return raw ? (JSON.parse(raw) as string[]) : null;
    } catch {
      return null;
    }
  }

  private async safeSet(key: string, value: string[]) {
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
}
