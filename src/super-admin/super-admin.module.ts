import { Module } from '@nestjs/common';
import { DesignsModule } from '../designs/designs.module';
import { MenusModule } from '../menus/menus.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { AnalyticsService } from './analytics.service';
import { AuditService } from './audit.service';
import { CafesAdminService } from './cafes.service';
import { MenuFileTemplatesService } from './menu-file-templates.service';
import { MenuTemplatesService } from './menu-templates.service';
import { SuperAdminController } from './super-admin.controller';
import { UsersAdminService } from './users.service';

@Module({
  imports: [MenusModule, OnboardingModule, NotificationsModule, DesignsModule],
  controllers: [SuperAdminController],
  providers: [
    AuditService,
    UsersAdminService,
    CafesAdminService,
    MenuTemplatesService,
    MenuFileTemplatesService,
    AnalyticsService,
  ],
})
export class SuperAdminModule {}
