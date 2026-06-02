import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PassportCheckinDto } from './dto/passport-checkin.dto';
import { PassportService } from './passport.service';

@Controller('passport')
export class PassportController {
  constructor(private passportService: PassportService) {}

  @Get('me')
  getMe(@CurrentUser() user: { id: string }) {
    return this.passportService.getMyPassport(user.id);
  }

  @Post('checkin')
  checkin(
    @CurrentUser() user: { id: string },
    @Body() dto: PassportCheckinDto,
  ) {
    return this.passportService.checkin(user.id, dto);
  }

  @Public()
  @Get('cafe-by-code/:code')
  cafeByCode(@Param('code') code: string) {
    return this.passportService.resolveCafeByCode(code);
  }

  @Post('rewards/:rewardId/redeem')
  redeem(
    @CurrentUser() user: { id: string },
    @Param('rewardId') rewardId: string,
  ) {
    return this.passportService.redeemReward(user.id, rewardId);
  }
}
