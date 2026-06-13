import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CafeRole } from '@prisma/client';
import type { Response } from 'express';
import {
  CAFE_EDIT_ROLES,
  CAFE_MARKETING_ROLES,
  CafeRoles,
} from '../common/decorators/cafe-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CafeStaffGuard } from '../common/guards/cafe-staff.guard';
import { EventsService } from '../events/events.service';
import { AuditService } from './audit.service';
import { CafeAnalyticsService } from './analytics.service';
import { CafeOsService } from './cafe-os.service';
import { CrmService } from './crm.service';
import {
  AnalyticsRangeDto,
  CreateCafeDto,
  CreateCafeEventDto,
  CreateQrDto,
  CreateTableDto,
  InviteStaffDto,
  RedeemLoyaltyDto,
  RenameTableDto,
  ReorderDto,
  RespondInviteDto,
  UpdateCafeProfileDto,
  UpdateCustomerDto,
  UpdateStaffRoleDto,
  UpsertAnnouncementDto,
  UpsertLoyaltyProgramDto,
} from './dto/cafe-os.dto';
import { LoyaltyService } from './loyalty.service';
import { MarketingService } from './marketing.service';
import { QrService } from './qr.service';

type AuthedUser = { id: string };

function localeOf(acceptLanguage?: string) {
  return acceptLanguage?.split(',')[0]?.split('-')[0] === 'fa' ? 'fa' : 'en';
}

@Controller('cafe-os')
export class CafeOsController {
  constructor(
    private cafeOs: CafeOsService,
    private qr: QrService,
    private crm: CrmService,
    private loyalty: LoyaltyService,
    private analytics: CafeAnalyticsService,
    private marketing: MarketingService,
    private audit: AuditService,
    private events: EventsService,
  ) {}

  // ---------- My cafes & invites (no cafe scope) ----------

  @Post('cafes')
  createCafe(@CurrentUser() user: AuthedUser, @Body() dto: CreateCafeDto) {
    return this.cafeOs.createCafe(user.id, dto);
  }

  @Get('cafes')
  myCafes(@CurrentUser() user: AuthedUser) {
    return this.cafeOs.myCafes(user.id);
  }

  @Get('invites')
  myInvites(@CurrentUser() user: AuthedUser) {
    return this.cafeOs.myInvites(user.id);
  }

  @Post('invites/:inviteId/respond')
  respondInvite(
    @CurrentUser() user: AuthedUser,
    @Param('inviteId') inviteId: string,
    @Body() dto: RespondInviteDto,
  ) {
    return this.cafeOs.respondInvite(user.id, inviteId, dto.accept);
  }

  // ---------- Cafe profile ----------

  @Get('cafes/:cafeId')
  @UseGuards(CafeStaffGuard)
  getCafe(@Param('cafeId') cafeId: string) {
    return this.cafeOs.getCafe(cafeId);
  }

  @Patch('cafes/:cafeId')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  updateCafe(
    @CurrentUser() user: AuthedUser,
    @Param('cafeId') cafeId: string,
    @Body() dto: UpdateCafeProfileDto,
  ) {
    return this.cafeOs.updateCafe(user.id, cafeId, dto);
  }

  // ---------- Staff ----------

  @Get('cafes/:cafeId/staff')
  @UseGuards(CafeStaffGuard)
  listStaff(@Param('cafeId') cafeId: string) {
    return this.cafeOs.listStaff(cafeId);
  }

  @Post('cafes/:cafeId/staff/invite')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  inviteStaff(
    @CurrentUser() user: AuthedUser,
    @Param('cafeId') cafeId: string,
    @Body() dto: InviteStaffDto,
  ) {
    return this.cafeOs.inviteStaff(user.id, cafeId, dto);
  }

  @Delete('cafes/:cafeId/staff/invites/:inviteId')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  cancelInvite(
    @CurrentUser() user: AuthedUser,
    @Param('cafeId') cafeId: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.cafeOs.cancelInvite(user.id, cafeId, inviteId);
  }

  @Patch('cafes/:cafeId/staff/:staffId')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(CafeRole.OWNER)
  updateStaffRole(
    @CurrentUser() user: AuthedUser,
    @Param('cafeId') cafeId: string,
    @Param('staffId') staffId: string,
    @Body() dto: UpdateStaffRoleDto,
  ) {
    return this.cafeOs.updateStaffRole(user.id, cafeId, staffId, dto.role);
  }

  @Delete('cafes/:cafeId/staff/:staffId')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(CafeRole.OWNER)
  removeStaff(
    @CurrentUser() user: AuthedUser,
    @Param('cafeId') cafeId: string,
    @Param('staffId') staffId: string,
  ) {
    return this.cafeOs.removeStaff(user.id, cafeId, staffId);
  }

  @Get('cafes/:cafeId/audit-log')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  auditLog(
    @Param('cafeId') cafeId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.audit.list(cafeId, cursor);
  }

  // ---------- Dashboard & analytics ----------

  @Get('cafes/:cafeId/dashboard')
  @UseGuards(CafeStaffGuard)
  dashboard(@Param('cafeId') cafeId: string) {
    return this.analytics.dashboard(cafeId);
  }

  @Get('cafes/:cafeId/analytics')
  @UseGuards(CafeStaffGuard)
  analyticsCenter(
    @Param('cafeId') cafeId: string,
    @Query() query: AnalyticsRangeDto,
  ) {
    return this.analytics.analytics(cafeId, query.range ?? '30d');
  }

  // ---------- Tables ----------

  @Get('cafes/:cafeId/tables')
  @UseGuards(CafeStaffGuard)
  listTables(@Param('cafeId') cafeId: string) {
    return this.qr.listTables(cafeId);
  }

  @Post('cafes/:cafeId/tables')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  createTable(
    @CurrentUser() user: AuthedUser,
    @Param('cafeId') cafeId: string,
    @Body() dto: CreateTableDto,
  ) {
    return this.qr.createTable(user.id, cafeId, dto.name);
  }

  @Patch('cafes/:cafeId/tables/reorder')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  reorderTables(@Param('cafeId') cafeId: string, @Body() dto: ReorderDto) {
    return this.qr.reorderTables(cafeId, dto.ids);
  }

  @Patch('cafes/:cafeId/tables/:tableId')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  renameTable(
    @CurrentUser() user: AuthedUser,
    @Param('cafeId') cafeId: string,
    @Param('tableId') tableId: string,
    @Body() dto: RenameTableDto,
  ) {
    return this.qr.renameTable(user.id, cafeId, tableId, dto.name);
  }

  @Delete('cafes/:cafeId/tables/:tableId')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  deleteTable(
    @CurrentUser() user: AuthedUser,
    @Param('cafeId') cafeId: string,
    @Param('tableId') tableId: string,
  ) {
    return this.qr.deleteTable(user.id, cafeId, tableId);
  }

  // ---------- QR codes ----------

  @Get('cafes/:cafeId/qr')
  @UseGuards(CafeStaffGuard)
  listQr(@Param('cafeId') cafeId: string) {
    return this.qr.listQrCodes(cafeId);
  }

  @Post('cafes/:cafeId/qr')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  createQr(
    @CurrentUser() user: AuthedUser,
    @Param('cafeId') cafeId: string,
    @Body() dto: CreateQrDto,
  ) {
    return this.qr.createQr(user.id, cafeId, dto.kind, dto.label, dto.eventId);
  }

  @Delete('cafes/:cafeId/qr/:qrId')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  deleteQr(
    @CurrentUser() user: AuthedUser,
    @Param('cafeId') cafeId: string,
    @Param('qrId') qrId: string,
  ) {
    return this.qr.deleteQr(user.id, cafeId, qrId);
  }

  @Get('cafes/:cafeId/qr/:qrId/data')
  @UseGuards(CafeStaffGuard)
  qrData(
    @Param('cafeId') cafeId: string,
    @Param('qrId') qrId: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.qr.renderDataUrl(cafeId, qrId, localeOf(acceptLanguage));
  }

  @Get('cafes/:cafeId/qr/:qrId/png')
  @UseGuards(CafeStaffGuard)
  async qrPng(
    @Param('cafeId') cafeId: string,
    @Param('qrId') qrId: string,
    @Res() res: Response,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const buffer = await this.qr.renderPng(
      cafeId,
      qrId,
      localeOf(acceptLanguage),
    );
    res.setHeader('Content-Type', 'image/png');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="qr-${qrId}.png"`,
    );
    res.send(buffer);
  }

  @Get('cafes/:cafeId/qr/:qrId/svg')
  @UseGuards(CafeStaffGuard)
  async qrSvg(
    @Param('cafeId') cafeId: string,
    @Param('qrId') qrId: string,
    @Res() res: Response,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const svg = await this.qr.renderSvg(cafeId, qrId, localeOf(acceptLanguage));
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="qr-${qrId}.svg"`,
    );
    res.send(svg);
  }

  // ---------- Customers (CRM) ----------

  @Get('cafes/:cafeId/customers')
  @UseGuards(CafeStaffGuard)
  listCustomers(
    @Param('cafeId') cafeId: string,
    @Query('q') q?: string,
    @Query('sort') sort?: 'recent' | 'visits',
    @Query('cursor') cursor?: string,
  ) {
    return this.crm.listCustomers(cafeId, { q, sort, cursor });
  }

  @Get('cafes/:cafeId/customers/:customerId')
  @UseGuards(CafeStaffGuard)
  customerDetail(
    @Param('cafeId') cafeId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.crm.customerDetail(cafeId, customerId);
  }

  @Patch('cafes/:cafeId/customers/:customerId')
  @UseGuards(CafeStaffGuard)
  updateCustomer(
    @CurrentUser() user: AuthedUser,
    @Param('cafeId') cafeId: string,
    @Param('customerId') customerId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.crm.updateCustomer(user.id, cafeId, customerId, dto);
  }

  // ---------- Loyalty ----------

  @Get('cafes/:cafeId/loyalty')
  @UseGuards(CafeStaffGuard)
  listLoyalty(@Param('cafeId') cafeId: string) {
    return this.loyalty.listPrograms(cafeId);
  }

  @Post('cafes/:cafeId/loyalty')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  createLoyalty(
    @CurrentUser() user: AuthedUser,
    @Param('cafeId') cafeId: string,
    @Body() dto: UpsertLoyaltyProgramDto,
  ) {
    return this.loyalty.createProgram(user.id, cafeId, dto);
  }

  @Patch('cafes/:cafeId/loyalty/:programId')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  updateLoyalty(
    @CurrentUser() user: AuthedUser,
    @Param('cafeId') cafeId: string,
    @Param('programId') programId: string,
    @Body() dto: UpsertLoyaltyProgramDto,
  ) {
    return this.loyalty.updateProgram(user.id, cafeId, programId, dto);
  }

  @Delete('cafes/:cafeId/loyalty/:programId')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  deleteLoyalty(
    @CurrentUser() user: AuthedUser,
    @Param('cafeId') cafeId: string,
    @Param('programId') programId: string,
  ) {
    return this.loyalty.deleteProgram(user.id, cafeId, programId);
  }

  @Get('cafes/:cafeId/loyalty/:programId/progress')
  @UseGuards(CafeStaffGuard)
  loyaltyProgress(
    @Param('cafeId') cafeId: string,
    @Param('programId') programId: string,
  ) {
    return this.loyalty.programProgress(cafeId, programId);
  }

  @Post('cafes/:cafeId/loyalty/:programId/redeem')
  @UseGuards(CafeStaffGuard)
  redeemLoyalty(
    @CurrentUser() user: AuthedUser,
    @Param('cafeId') cafeId: string,
    @Param('programId') programId: string,
    @Body() dto: RedeemLoyaltyDto,
  ) {
    return this.loyalty.redeem(user.id, cafeId, programId, dto.userId);
  }

  // ---------- Marketing ----------

  @Get('cafes/:cafeId/announcements')
  @UseGuards(CafeStaffGuard)
  listAnnouncements(@Param('cafeId') cafeId: string) {
    return this.marketing.list(cafeId);
  }

  @Post('cafes/:cafeId/announcements')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_MARKETING_ROLES)
  createAnnouncement(
    @CurrentUser() user: AuthedUser,
    @Param('cafeId') cafeId: string,
    @Body() dto: UpsertAnnouncementDto,
  ) {
    return this.marketing.create(user.id, cafeId, dto);
  }

  @Patch('cafes/:cafeId/announcements/:id')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_MARKETING_ROLES)
  updateAnnouncement(
    @CurrentUser() user: AuthedUser,
    @Param('cafeId') cafeId: string,
    @Param('id') id: string,
    @Body() dto: UpsertAnnouncementDto,
  ) {
    return this.marketing.update(user.id, cafeId, id, dto);
  }

  @Delete('cafes/:cafeId/announcements/:id')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_MARKETING_ROLES)
  deleteAnnouncement(
    @CurrentUser() user: AuthedUser,
    @Param('cafeId') cafeId: string,
    @Param('id') id: string,
  ) {
    return this.marketing.remove(user.id, cafeId, id);
  }

  // ---------- Events ----------

  @Get('cafes/:cafeId/events')
  @UseGuards(CafeStaffGuard)
  listEvents(@Param('cafeId') cafeId: string) {
    return this.events.listForCafe(cafeId);
  }

  @Post('cafes/:cafeId/events')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_MARKETING_ROLES)
  async createEvent(
    @CurrentUser() user: AuthedUser,
    @Param('cafeId') cafeId: string,
    @Body() dto: CreateCafeEventDto,
  ) {
    const event = await this.events.create(user.id, { ...dto, cafeId });
    await this.audit.log({
      cafeId,
      actorId: user.id,
      action: 'event.created',
      entity: 'event',
      entityId: event.id,
      meta: { title: dto.title },
    });
    return event;
  }

  @Get('cafes/:cafeId/events/:eventId/rsvps')
  @UseGuards(CafeStaffGuard)
  eventRsvps(@Param('eventId') eventId: string) {
    return this.events.participants(eventId);
  }
}
