import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkService } from './work.service';

class WorkReportDto {
  @IsInt()
  @Min(1)
  @Max(5)
  wifiScore: number;

  @IsInt()
  @Min(1)
  @Max(5)
  noiseLevel: number;

  @IsInt()
  @Min(1)
  @Max(5)
  outletScore: number;
}

@Controller('cafes')
export class WorkController {
  constructor(private work: WorkService) {}

  @Get(':id/work')
  insights(@Param('id') cafeId: string) {
    return this.work.getInsights(cafeId);
  }

  @Post(':id/work-reports')
  report(
    @CurrentUser() user: { id: string },
    @Param('id') cafeId: string,
    @Body() dto: WorkReportDto,
  ) {
    return this.work.submitReport(user.id, cafeId, dto);
  }
}
