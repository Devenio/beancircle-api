import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BugReportsService } from './bug-reports.service';
import { CreateBugReportDto } from './dto/create-bug-report.dto';

/** Reporter-facing endpoints (any authenticated user). */
@Controller('bug-reports')
export class BugReportsController {
  constructor(private bugReports: BugReportsService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateBugReportDto) {
    return this.bugReports.create(user.id, dto);
  }

  @Get('mine')
  listMine(
    @CurrentUser() user: { id: string },
    @Query('cursor') cursor?: string,
  ) {
    return this.bugReports.listMine(user.id, cursor);
  }

  @Get('mine/:id')
  getMine(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.bugReports.getMine(user.id, id);
  }
}
