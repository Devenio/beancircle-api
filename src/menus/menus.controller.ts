import { Body, Controller, Get, Headers, Param, Put } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpsertMenuDto } from './dto/upsert-menu.dto';
import { MenusService } from './menus.service';

@Controller()
export class MenusController {
  constructor(private menus: MenusService) {}

  @Public()
  @Get('menus/public/:slug')
  getPublic(@Param('slug') slug: string) {
    return this.menus.getPublicBySlug(slug);
  }

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
    const locale = acceptLanguage?.split(',')[0]?.split('-')[0] === 'fa' ? 'fa' : 'en';
    return this.menus.getQrCode(user.id, cafeId, locale);
  }
}
