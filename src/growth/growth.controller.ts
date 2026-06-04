import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GrowthService } from './growth.service';

class ApplyReferralDto {
  @IsString()
  @MinLength(4)
  @MaxLength(16)
  code: string;
}

@Controller('growth')
export class GrowthController {
  constructor(private growth: GrowthService) {}

  @Get('referrals/me')
  me(@CurrentUser() user: { id: string }) {
    return this.growth.getReferralStats(user.id);
  }

  @Post('referrals/apply')
  apply(@CurrentUser() user: { id: string }, @Body() dto: ApplyReferralDto) {
    return this.growth.applyReferralCode(user.id, dto.code);
  }
}
