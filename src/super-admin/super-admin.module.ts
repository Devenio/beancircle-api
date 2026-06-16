import { Module } from '@nestjs/common';
import { MenusModule } from '../menus/menus.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { AnalyticsService } from './analytics.service';
import { AuditService } from './audit.service';
import { CafesAdminService } from './cafes.service';
import { MenuFileTemplatesService } from './menu-file-templates.service';
import { MenuTemplatesService } from './menu-templates.service';
import { SuperAdminController } from './super-admin.controller';
import { UsersAdminService } from './users.service';

@Module({
  imports: [MenusModule, OnboardingModule],
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
