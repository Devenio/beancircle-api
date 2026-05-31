import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ReportStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { AdminGuard } from '../common/guards/admin.guard';
import { AdminService } from './admin.service';
import { GiftsService } from '../gifts/gifts.service';

class UpdateReportDto {
  @IsEnum(ReportStatus)
  status: ReportStatus;
}

@Controller('admin')
@UseGuards(AdminGuard)
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
  reports() {
    return this.adminService.listReports();
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
