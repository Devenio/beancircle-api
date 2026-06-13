import { Module } from '@nestjs/common';
import { BugReportsController } from './bug-reports.controller';
import { BugReportsAdminController } from './bug-reports.admin.controller';
import { BugReportsService } from './bug-reports.service';
import { BugTriageService } from './bug-triage.service';

@Module({
  controllers: [BugReportsController, BugReportsAdminController],
  providers: [BugReportsService, BugTriageService],
  exports: [BugReportsService],
})
export class BugReportsModule {}
