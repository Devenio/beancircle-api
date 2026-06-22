import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ReportStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { GiftsService } from '../gifts/gifts.service';

class UpdateReportDto {
  @IsEnum(ReportStatus)
  status: ReportStatus;
}

class ResolveReportDto {
  @IsOptional()
  @IsString()
  adminNote?: string;
}

class WarnUserDto {
  @IsOptional()
  @IsString()
  reason?: string;
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
  reports(
    @Query('cursor') cursor?: string,
    @Query('status') status?: ReportStatus,
  ) {
    return this.adminService.listReports(cursor, status);
  }

  @Get('reports/:id')
  getReport(@Param('id') id: string) {
    return this.adminService.getReport(id);
  }

  @Patch('reports/:id')
  updateReport(@Param('id') id: string, @Body() dto: UpdateReportDto) {
    return this.adminService.updateReport(id, dto.status);
  }

  @Post('reports/:id/resolve')
  resolveReport(
    @CurrentUser() actor: { id: string },
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.adminService.resolveReport(actor.id, id, dto.adminNote);
  }

  @Post('reports/:id/dismiss')
  dismissReport(
    @CurrentUser() actor: { id: string },
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.adminService.dismissReport(actor.id, id, dto.adminNote);
  }

  @Delete('reports/:id/content')
  removeContent(
    @CurrentUser() actor: { id: string },
    @Param('id') id: string,
  ) {
    return this.adminService.removeContent(actor.id, id);
  }

  @Post('users/:id/warn')
  warnUser(
    @CurrentUser() actor: { id: string },
    @Param('id') id: string,
    @Body() dto: WarnUserDto,
  ) {
    return this.adminService.warnUser(actor.id, id, dto.reason);
  }

  @Get('checkins')
  checkins() {
    return this.adminService.listCheckins();
  }

  @Get('gifts')
  gifts() {
    return this.giftsService.listAll();
  }
}
