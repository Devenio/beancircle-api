import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { MenusService } from '../menus/menus.service';
import {
  CreateCategoryDto,
  MenuItemFieldsDto,
  MenuSettingsDto,
  ReorderIdsDto,
  UpdateCategoryDto,
  UpdateMenuItemDto,
} from '../menus/dto/upsert-menu.dto';
import { AnalyticsService } from './analytics.service';
import { AuditService } from './audit.service';
import { CafesAdminService } from './cafes.service';
import { MenuTemplatesService } from './menu-templates.service';
import { UsersAdminService } from './users.service';
import {
  ApplyTemplateDto,
  SetCafeFlagDto,
  SetGlobalFlagDto,
  UpdateCafeDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  UpsertTemplateDto,
} from './dto/super-admin.dto';

type Actor = { id: string };

@Controller('super-admin')
@UseGuards(SuperAdminGuard)
@Throttle({ default: { limit: 60, ttl: 60000 } })
export class SuperAdminController {
  constructor(
    private flags: FeatureFlagsService,
    private users: UsersAdminService,
    private cafes: CafesAdminService,
    private templates: MenuTemplatesService,
    private analytics: AnalyticsService,
    private audit: AuditService,
    private menus: MenusService,
  ) {}

  // ---------------- Feature flags ----------------

  @Get('feature-flags')
  listFlags() {
    return this.flags.listForAdmin();
  }

  @Patch('feature-flags/:key')
  setFlag(
    @CurrentUser() actor: Actor,
    @Param('key') key: string,
    @Body() dto: SetGlobalFlagDto,
  ) {
    void this.audit.log(actor.id, 'flag.global.set', 'featureFlag', key, {
      enabled: dto.enabled,
    });
    return this.flags.setGlobal(key, dto.enabled);
  }

  @Put('feature-flags/:key/cafes/:cafeId')
  setCafeFlag(
    @CurrentUser() actor: Actor,
    @Param('key') key: string,
    @Param('cafeId') cafeId: string,
    @Body() dto: SetCafeFlagDto,
  ) {
    void this.audit.log(actor.id, 'flag.cafe.set', 'featureFlag', key, {
      cafeId,
      enabled: dto.enabled,
    });
    return this.flags.setCafeOverride(cafeId, key, dto.enabled ?? null);
  }

  // ---------------- Users ----------------

  @Get('users')
  listUsers(
    @Query('q') q?: string,
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
    @Query('cursor') cursor?: string,
  ) {
    return this.users.list({ q, role, status, cursor });
  }

  @Get('users/:id')
  userDetail(@Param('id') id: string) {
    return this.users.detail(id);
  }

  @Patch('users/:id/role')
  setUserRole(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.users.updateRole(actor.id, id, dto.role);
  }

  @Patch('users/:id/status')
  setUserStatus(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.users.updateStatus(actor.id, id, dto);
  }

  @Delete('users/:id')
  deleteUser(@CurrentUser() actor: Actor, @Param('id') id: string) {
    return this.users.remove(actor.id, id);
  }

  // ---------------- Cafes ----------------

  @Get('cafes')
  listCafes(@Query('q') q?: string, @Query('cursor') cursor?: string) {
    return this.cafes.list({ q, cursor });
  }

  @Patch('cafes/:id')
  updateCafe(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() dto: UpdateCafeDto,
  ) {
    return this.cafes.update(actor.id, id, dto);
  }

  @Delete('cafes/:id')
  deleteCafe(@CurrentUser() actor: Actor, @Param('id') id: string) {
    return this.cafes.remove(actor.id, id);
  }

  // ---------------- Menu templates ----------------

  @Get('menu-templates')
  listTemplates() {
    return this.templates.list();
  }

  @Get('menu-templates/:id')
  getTemplate(@Param('id') id: string) {
    return this.templates.get(id);
  }

  @Post('menu-templates')
  createTemplate(
    @CurrentUser() actor: Actor,
    @Body() dto: UpsertTemplateDto,
  ) {
    return this.templates.upsert(actor.id, dto);
  }

  @Put('menu-templates/:id')
  updateTemplate(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() dto: UpsertTemplateDto,
  ) {
    return this.templates.upsert(actor.id, dto, id);
  }

  @Delete('menu-templates/:id')
  deleteTemplate(@CurrentUser() actor: Actor, @Param('id') id: string) {
    return this.templates.remove(actor.id, id);
  }

  @Post('cafes/:cafeId/menu/apply-template/:templateId')
  applyTemplate(
    @CurrentUser() actor: Actor,
    @Param('cafeId') cafeId: string,
    @Param('templateId') templateId: string,
    @Body() dto: ApplyTemplateDto,
  ) {
    return this.templates.applyToCafe(actor.id, cafeId, templateId, dto);
  }

  // ---------- Direct editing of any cafe's live menu (delegates to MenusService) ----------

  @Get('cafes/:cafeId/menu')
  getCafeMenu(@Param('cafeId') cafeId: string) {
    return this.menus.getMenuForCafe(cafeId);
  }

  @Patch('cafes/:cafeId/menu')
  updateCafeMenu(
    @Param('cafeId') cafeId: string,
    @Body() dto: MenuSettingsDto,
  ) {
    return this.menus.updateSettings(cafeId, dto);
  }

  @Post('cafes/:cafeId/menu/categories')
  createCafeCategory(
    @Param('cafeId') cafeId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.menus.createCategory(cafeId, dto);
  }

  @Patch('cafes/:cafeId/menu/categories/reorder')
  reorderCafeCategories(
    @Param('cafeId') cafeId: string,
    @Body() dto: ReorderIdsDto,
  ) {
    return this.menus.reorderCategories(cafeId, dto.ids);
  }

  @Patch('cafes/:cafeId/menu/categories/:categoryId')
  updateCafeCategory(
    @Param('cafeId') cafeId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.menus.updateCategory(cafeId, categoryId, dto);
  }

  @Delete('cafes/:cafeId/menu/categories/:categoryId')
  deleteCafeCategory(
    @Param('cafeId') cafeId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.menus.deleteCategory(cafeId, categoryId);
  }

  @Post('cafes/:cafeId/menu/categories/:categoryId/items')
  createCafeItem(
    @Param('cafeId') cafeId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: MenuItemFieldsDto,
  ) {
    return this.menus.createItem(cafeId, categoryId, dto);
  }

  @Patch('cafes/:cafeId/menu/items/:itemId')
  updateCafeItem(
    @Param('cafeId') cafeId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menus.updateItem(cafeId, itemId, dto);
  }

  @Delete('cafes/:cafeId/menu/items/:itemId')
  deleteCafeItem(
    @Param('cafeId') cafeId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.menus.deleteItem(cafeId, itemId);
  }

  // ---------------- Analytics ----------------

  @Get('analytics/overview')
  overview(@Query('days') days?: string) {
    return this.analytics.overview(days ? Number(days) : 30);
  }

  @Get('analytics/timeseries')
  timeseries(@Query('metric') metric: string, @Query('days') days?: string) {
    return this.analytics.timeseries(metric, days ? Number(days) : 30);
  }

  @Get('analytics/top-cafes')
  topCafes(@Query('limit') limit?: string) {
    return this.analytics.topCafes(limit ? Number(limit) : 10);
  }

  @Get('analytics/users-by-role')
  usersByRole() {
    return this.analytics.usersByRole();
  }

  // ---------------- Audit ----------------

  @Get('audit')
  audyt(@Query('cursor') cursor?: string) {
    return this.audit.list(cursor);
  }
}
