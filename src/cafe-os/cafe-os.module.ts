import { Module, forwardRef } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AuditService } from './audit.service';
import { CafeAnalyticsService } from './analytics.service';
import { CafeOsController } from './cafe-os.controller';
import { CafeOsHooksService } from './cafe-os-hooks.service';
import { CafeOsService } from './cafe-os.service';
import { CafePublicController } from './cafe-public.controller';
import { CrmService } from './crm.service';
import { LoyaltyService } from './loyalty.service';
import { MarketingService } from './marketing.service';
import { QrService } from './qr.service';

@Module({
  imports: [
    NotificationsModule,
    EventsModule,
    forwardRef(() => RealtimeModule),
  ],
  controllers: [CafeOsController, CafePublicController],
  providers: [
    AuditService,
    CafeOsService,
    CafeAnalyticsService,
    CafeOsHooksService,
    CrmService,
    LoyaltyService,
    MarketingService,
    QrService,
  ],
  exports: [CafeOsHooksService, QrService, CrmService, LoyaltyService],
})
export class CafeOsModule {}
