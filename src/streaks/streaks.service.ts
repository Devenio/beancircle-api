import { Injectable } from '@nestjs/common';
import { StreakType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MILESTONES = [3, 7, 14, 30, 50, 100, 365];

export interface StreakTouchResult {
  type: StreakType;
  current: number;
  best: number;
  increased: boolean;
  milestone: number | null;
}

@Injectable()
export class StreakService {
  constructor(private prisma: PrismaService) {}

  private dayKey(d: Date) {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    return x;
  }

  /** Number of whole UTC days between two day-aligned dates. */
  private dayDiff(a: Date, b: Date) {
    return Math.round((this.dayKey(b).getTime() - this.dayKey(a).getTime()) / 86400000);
  }

  /** ISO-week aligned diff (in weeks) for weekly streaks. */
  private weekDiff(a: Date, b: Date) {
    return Math.floor(this.dayDiff(a, b) / 7);
  }

  /**
   * Register a streak event. Idempotent within the same period (day/week),
   * extends the streak when the previous period was hit, otherwise resets.
   */
  async touch(
    userId: string,
    type: StreakType,
    when: Date = new Date(),
  ): Promise<StreakTouchResult> {
    const isWeekly = type === StreakType.WEEKLY_CAFE;
    const today = this.dayKey(when);

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.userStreak.findUnique({
        where: { userId_type: { userId, type } },
      });

      let current = 1;
      let increased = true;

      if (existing?.lastEventOn) {
        const diff = isWeekly
          ? this.weekDiff(existing.lastEventOn, when)
          : this.dayDiff(existing.lastEventOn, when);

        if (diff <= 0) {
          return {
            type,
            current: existing.current,
            best: existing.best,
            increased: false,
            milestone: null as number | null,
          };
        }
        if (diff === 1) {
          current = existing.current + 1;
        } else {
          current = 1;
        }
      }

      const best = Math.max(current, existing?.best ?? 0);

      await tx.userStreak.upsert({
        where: { userId_type: { userId, type } },
        create: { userId, type, current, best, lastEventOn: today },
        update: { current, best, lastEventOn: today },
      });

      const milestone =
        increased && MILESTONES.includes(current) ? current : null;

      return { type, current, best, increased, milestone };
    });

    return result;
  }

  async getMine(userId: string) {
    const streaks = await this.prisma.userStreak.findMany({
      where: { userId },
    });
    const byType = new Map(streaks.map((s) => [s.type, s]));
    const all = Object.values(StreakType).map((type) => {
      const s = byType.get(type);
      return {
        type,
        current: s?.current ?? 0,
        best: s?.best ?? 0,
        lastEventOn: s?.lastEventOn ?? null,
        nextMilestone: MILESTONES.find((m) => m > (s?.current ?? 0)) ?? null,
      };
    });
    return {
      streaks: all,
      headline: all.reduce((max, s) => (s.current > max.current ? s : max), all[0]),
    };
  }
}
