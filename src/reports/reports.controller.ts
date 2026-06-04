import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateReportDto,
  ) {
    return this.reportsService.create(user.id, dto);
  }
}
