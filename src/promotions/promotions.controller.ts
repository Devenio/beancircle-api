import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsString } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PromotionsService } from './promotions.service';

class RedeemDailyDealDto {
  @IsString()
  voucherCode: string;

  @IsString()
  cafeId: string;
}

@Controller('promotions')
export class PromotionsController {
  constructor(private promotions: PromotionsService) {}

  @Get('me/today')
  myWinsToday(@CurrentUser() user: { id: string }) {
    return this.promotions.getMyWinsToday(user.id);
  }

  @Get('cafe/:cafeId/today')
  cafeStatus(
    @CurrentUser() user: { id: string },
    @Param('cafeId') cafeId: string,
  ) {
    return this.promotions.getCafeStatus(user.id, cafeId);
  }

  @Get('voucher/:winnerId')
  voucherQr(
    @CurrentUser() user: { id: string },
    @Param('winnerId') winnerId: string,
  ) {
    return this.promotions.getVoucherQr(winnerId, user.id);
  }

  @Post('redeem')
  redeem(
    @CurrentUser() _user: { id: string },
    @Body() dto: RedeemDailyDealDto,
  ) {
    return this.promotions.redeem(dto.voucherCode, dto.cafeId);
  }
}
