import { Injectable, Logger } from '@nestjs/common';
import { CafeAnalyticsService } from './analytics.service';
import { CrmService } from './crm.service';
import { LoyaltyService } from './loyalty.service';

/**
 * Facade used by other modules (check-ins, scans) to feed the Cafe OS
 * CRM, loyalty engine and realtime dashboard without tight coupling.
 */
@Injectable()
export class CafeOsHooksService {
  private readonly logger = new Logger(CafeOsHooksService.name);

  constructor(
    private crm: CrmService,
    private loyalty: LoyaltyService,
    private analytics: CafeAnalyticsService,
  ) {}

  /** Called after a confirmed check-in. Never throws. */
  async onCheckin(cafeId: string, userId: string) {
    try {
      const customer = await this.crm.recordVisit(cafeId, userId);
      const completed = await this.loyalty.onVisit(cafeId, userId);
      this.analytics.emitStats(cafeId, {
        event: 'checkin',
        visitCount: customer.visitCount,
      });
      return { customer, completedPrograms: completed };
    } catch (e) {
      this.logger.error(`onCheckin hook failed: ${(e as Error).message}`);
      return null;
    }
  }

  /** Called after a public QR menu scan. Never throws. */
  async onScan(cafeId: string, userId?: string | null) {
    try {
      if (userId) {
        await this.crm.recordScan(cafeId, userId);
      }
      this.analytics.emitStats(cafeId, { event: 'scan' });
    } catch (e) {
      this.logger.error(`onScan hook failed: ${(e as Error).message}`);
    }
  }
}
