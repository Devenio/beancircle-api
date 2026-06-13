import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ReportStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { AdminGuard } from '../common/guards/admin.guard';
import { AdminService } from './admin.service';
import { GiftsService } from '../gifts/gifts.service';

class UpdateReportDto {
  @IsEnum(ReportStatus)
  status: ReportStatus;
}

@Controller('admin')
@UseGuards(AdminGuard)
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class AdminController {
  constructor(
    private adminService: AdminService,
    private giftsService: GiftsService,
  ) {}

  @Get('users')
  users() {
    return this.adminService.listUsers();
  }

  @Get('cafes')
  cafes() {
    return this.adminService.listCafes();
  }

  @Get('reviews')
  reviews() {
    return this.adminService.listReviews();
  }

  @Get('reports')
  reports(@Query('cursor') cursor?: string) {
    return this.adminService.listReports(cursor);
  }

  @Get('checkins')
  checkins() {
    return this.adminService.listCheckins();
  }

  @Get('gifts')
  gifts() {
    return this.giftsService.listAll();
  }

  @Patch('reports/:id')
  updateReport(@Param('id') id: string, @Body() dto: UpdateReportDto) {
    return this.adminService.updateReport(id, dto.status);
  }
}
