import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  CAFE_EDIT_ROLES,
  CafeRoles,
} from '../common/decorators/cafe-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CafeStaffGuard } from '../common/guards/cafe-staff.guard';
import {
  CreateCategoryDto,
  MenuItemFieldsDto,
  MenuSettingsDto,
  ReorderIdsDto,
  UpdateCategoryDto,
  UpdateMenuItemDto,
  UpsertMenuDto,
} from './dto/upsert-menu.dto';
import { MenusService } from './menus.service';

class PublicScanBodyDto {
  code?: string;
}

@Controller()
export class MenusController {
  constructor(
    private menus: MenusService,
    private jwt: JwtService,
  ) {}

  /** Best-effort identification on public routes (token optional). */
  private async optionalUserId(authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return undefined;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      return payload.sub;
    } catch {
      return undefined;
    }
  }

  // ---------- Public ----------

  @Public()
  @Get('menus/public/:slug')
  getPublic(@Param('slug') slug: string) {
    return this.menus.getPublicBySlug(slug);
  }

  @Public()
  @Post('menus/public/:slug/scan')
  async scan(
    @Param('slug') slug: string,
    @Body() body: PublicScanBodyDto,
    @Headers('authorization') authorization?: string,
  ) {
    const userId = await this.optionalUserId(authorization);
    return this.menus.recordPublicScan(slug, body?.code, userId);
  }

  @Public()
  @Post('menus/public/:slug/items/:itemId/view')
  itemView(@Param('slug') slug: string, @Param('itemId') itemId: string) {
    return this.menus.recordItemView(slug, itemId);
  }

  // ---------- Legacy owner endpoints (kept for compatibility) ----------

  @Get('owner/cafes/:id/menu')
  getOwner(
    @CurrentUser() user: { id: string },
    @Param('id') cafeId: string,
  ) {
    return this.menus.getOwnerMenu(user.id, cafeId);
  }

  @Put('owner/cafes/:id/menu')
  upsert(
    @CurrentUser() user: { id: string },
    @Param('id') cafeId: string,
    @Body() dto: UpsertMenuDto,
  ) {
    return this.menus.upsertMenu(user.id, cafeId, dto);
  }

  @Get('owner/cafes/:id/menu/qr')
  qr(
    @CurrentUser() user: { id: string },
    @Param('id') cafeId: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const locale =
      acceptLanguage?.split(',')[0]?.split('-')[0] === 'fa' ? 'fa' : 'en';
    return this.menus.getQrCode(user.id, cafeId, locale);
  }

  // ---------- Cafe OS: granular menu builder ----------

  @Get('cafe-os/cafes/:cafeId/menu')
  @UseGuards(CafeStaffGuard)
  getMenu(@Param('cafeId') cafeId: string) {
    return this.menus.getMenuForCafe(cafeId);
  }

  @Patch('cafe-os/cafes/:cafeId/menu')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  updateSettings(
    @Param('cafeId') cafeId: string,
    @Body() dto: MenuSettingsDto,
  ) {
    return this.menus.updateSettings(cafeId, dto);
  }

  @Post('cafe-os/cafes/:cafeId/menu/categories')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  createCategory(
    @Param('cafeId') cafeId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.menus.createCategory(cafeId, dto);
  }

  @Patch('cafe-os/cafes/:cafeId/menu/categories/reorder')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  reorderCategories(
    @Param('cafeId') cafeId: string,
    @Body() dto: ReorderIdsDto,
  ) {
    return this.menus.reorderCategories(cafeId, dto.ids);
  }

  @Patch('cafe-os/cafes/:cafeId/menu/categories/:categoryId')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  updateCategory(
    @Param('cafeId') cafeId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.menus.updateCategory(cafeId, categoryId, dto);
  }

  @Delete('cafe-os/cafes/:cafeId/menu/categories/:categoryId')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  deleteCategory(
    @Param('cafeId') cafeId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.menus.deleteCategory(cafeId, categoryId);
  }

  @Post('cafe-os/cafes/:cafeId/menu/categories/:categoryId/items')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  createItem(
    @Param('cafeId') cafeId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: MenuItemFieldsDto,
  ) {
    return this.menus.createItem(cafeId, categoryId, dto);
  }

  @Patch('cafe-os/cafes/:cafeId/menu/categories/:categoryId/items/reorder')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  reorderItems(
    @Param('cafeId') cafeId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: ReorderIdsDto,
  ) {
    return this.menus.reorderItems(cafeId, categoryId, dto.ids);
  }

  @Patch('cafe-os/cafes/:cafeId/menu/items/:itemId')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  updateItem(
    @Param('cafeId') cafeId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menus.updateItem(cafeId, itemId, dto);
  }

  @Delete('cafe-os/cafes/:cafeId/menu/items/:itemId')
  @UseGuards(CafeStaffGuard)
  @CafeRoles(...CAFE_EDIT_ROLES)
  deleteItem(
    @Param('cafeId') cafeId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.menus.deleteItem(cafeId, itemId);
  }
}
