import { Module } from '@nestjs/common';
import { MenusModule } from '../menus/menus.module';
import { AnalyticsService } from './analytics.service';
import { AuditService } from './audit.service';
import { CafesAdminService } from './cafes.service';
import { MenuTemplatesService } from './menu-templates.service';
import { SuperAdminController } from './super-admin.controller';
import { UsersAdminService } from './users.service';

@Module({
  imports: [MenusModule],
  controllers: [SuperAdminController],
  providers: [
    AuditService,
    UsersAdminService,
    CafesAdminService,
    MenuTemplatesService,
    AnalyticsService,
  ],
})
export class SuperAdminModule {}
