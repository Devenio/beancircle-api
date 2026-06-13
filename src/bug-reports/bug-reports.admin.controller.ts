import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BugReportsService } from './bug-reports.service';
import { ListBugReportsDto } from './dto/list-bug-reports.dto';
import { UpdateBugReportDto } from './dto/update-bug-report.dto';
import { AddBugCommentDto } from './dto/add-comment.dto';

/** Support-team dashboard endpoints (admin only). */
@Controller('admin/bug-reports')
@UseGuards(AdminGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class BugReportsAdminController {
  constructor(private bugReports: BugReportsService) {}

  @Get()
  list(@Query() filters: ListBugReportsDto) {
    return this.bugReports.adminList(filters);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.bugReports.adminGet(id);
  }

  @Get(':id/duplicates')
  duplicates(@Param('id') id: string) {
    return this.bugReports.adminDuplicates(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBugReportDto) {
    return this.bugReports.adminUpdate(id, dto);
  }

  @Post(':id/comments')
  addComment(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: AddBugCommentDto,
  ) {
    return this.bugReports.addComment(id, user.id, dto);
  }
}
