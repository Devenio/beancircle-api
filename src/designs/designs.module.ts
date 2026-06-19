import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditService } from '../super-admin/audit.service';
import { DesignsController } from './designs.controller';
import { DesignsService } from './designs.service';

/**
 * Coded-design system (three layers):
 *   1. Registry  — design-registry.ts (code source of truth)
 *   2. Access    — admin whitelists designs per cafe (super-admin routes)
 *   3. Selection — cafe owner picks menu/welcome designs (DesignsController)
 * DesignsService is exported so the super-admin controller and the public
 * menu endpoint can reuse the same access + resolution logic.
 */
@Module({
  imports: [AuthModule],
  controllers: [DesignsController],
  providers: [DesignsService, AuditService],
  exports: [DesignsService],
})
export class DesignsModule {}
