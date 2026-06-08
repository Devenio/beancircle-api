import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { DiscoverPeopleService } from './discover-people.service';

export type DiscoverScanStats = {
  nearbyCount: number;
  sharedInterestsCount: number;
  matchPotential: 'low' | 'medium' | 'high';
};

export type DiscoverScanSignal = {
  index: number;
  distanceLabel: string;
  distanceM: number;
};

export type DiscoverScanPerson = Awaited<
  ReturnType<DiscoverPeopleService['nearby']>
>['items'][number];

export type DiscoverScanResult = {
  scanId: string;
  signals: DiscoverScanSignal[];
  items: DiscoverScanPerson[];
  stats: DiscoverScanStats;
};

type ActiveScan = {
  timers: ReturnType<typeof setTimeout>[];
  cancelled: boolean;
};

@Injectable()
export class DiscoverScanService {
  private readonly activeScans = new Map<string, ActiveScan>();

  constructor(
    private discoverPeople: DiscoverPeopleService,
    @Inject(forwardRef(() => RealtimeGateway))
    private realtime: RealtimeGateway,
  ) {}

  async startScan(userId: string, radiusKm = 5): Promise<DiscoverScanResult> {
    this.cancelScan(userId);
    const scanId = `${userId}:${Date.now()}`;
    const active: ActiveScan = { timers: [], cancelled: false };
    this.activeScans.set(userId, active);

    const result = await this.discoverPeople.nearby(userId, {
      radiusKm,
      limit: 24,
      relationship: 'not_friends',
    });

    const items = result.items;
    const sharedInterestsCount = items.reduce(
      (sum, p) => sum + (p.sharedInterests?.length ?? 0),
      0,
    );
    const avgScore =
      items.length > 0
        ? items.reduce((s, p) => s + (p.score ?? 0), 0) / items.length
        : 0;
    const matchPotential: DiscoverScanStats['matchPotential'] =
      avgScore >= 0.65 ? 'high' : avgScore >= 0.4 ? 'medium' : 'low';

    const stats: DiscoverScanStats = {
      nearbyCount: items.length,
      sharedInterestsCount,
      matchPotential,
    };

    const signals: DiscoverScanSignal[] = items.map((p, index) => ({
      index,
      distanceLabel: p.distanceLabel ?? `${Math.round((p.distanceM ?? 500) / 100) / 10}km`,
      distanceM: p.distanceM ?? 500,
    }));

    const scanResult: DiscoverScanResult = { scanId, signals, items, stats };

    this.scheduleProgressiveEmit(userId, scanId, scanResult, active);
    return scanResult;
  }

  cancelScan(userId: string) {
    const active = this.activeScans.get(userId);
    if (!active) return;
    active.cancelled = true;
    for (const t of active.timers) clearTimeout(t);
    this.activeScans.delete(userId);
    this.realtime.emitToUser(userId, 'discover:scan:cancelled', { userId });
  }

  private scheduleProgressiveEmit(
    userId: string,
    scanId: string,
    result: DiscoverScanResult,
    active: ActiveScan,
  ) {
    const emit = (event: string, data: unknown) => {
      if (active.cancelled) return;
      this.realtime.emitToUser(userId, event, data);
    };

    const schedule = (ms: number, fn: () => void) => {
      const t = setTimeout(fn, ms);
      active.timers.push(t);
    };

    schedule(0, () => {
      emit('discover:scan:progress', {
        scanId,
        stage: 'radar',
      });
    });

    schedule(800, () => {
      emit('discover:scan:progress', {
        scanId,
        stage: 'scanning',
        messageIndex: 0,
      });
    });

    const scanMessages = 3;
    for (let i = 1; i < scanMessages; i++) {
      schedule(800 + i * 1400, () => {
        emit('discover:scan:progress', {
          scanId,
          stage: 'scanning',
          messageIndex: i,
        });
      });
    }

    const signalBase = 800 + scanMessages * 1400;
    if (result.signals.length === 0) {
      schedule(signalBase + 600, () => {
        emit('discover:scan:complete', {
          scanId,
          stage: 'empty',
          stats: result.stats,
          items: [],
        });
        this.activeScans.delete(userId);
      });
      return;
    }

    result.signals.forEach((signal, i) => {
      schedule(signalBase + i * 900, () => {
        emit('discover:scan:signal', { scanId, ...signal });
      });
    });

    const revealBase = signalBase + result.signals.length * 900 + 400;
    result.items.forEach((person, i) => {
      schedule(revealBase + i * 1100, () => {
        emit('discover:scan:reveal', { scanId, index: i, person });
      });
    });

    schedule(revealBase + result.items.length * 1100 + 600, () => {
      emit('discover:scan:complete', {
        scanId,
        stage: 'complete',
        stats: result.stats,
        items: result.items,
      });
      this.activeScans.delete(userId);
    });
  }
}
