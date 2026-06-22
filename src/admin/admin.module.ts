import { Module } from '@nestjs/common';
import { GiftsModule } from '../gifts/gifts.module';
import { AuditService } from '../super-admin/audit.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [GiftsModule],
  controllers: [AdminController],
  providers: [AdminService, AuditService],
})
export class AdminModule {}
