import { Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BeanScoreService } from './beanscore.service';

@Controller('beanscore')
export class BeanScoreController {
  constructor(private beanScore: BeanScoreService) {}

  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.beanScore.getProfile(user.id);
  }

  @Get('me/events')
  events(@CurrentUser() user: { id: string }) {
    return this.beanScore.recentEvents(user.id);
  }

  @Post('daily')
  daily(@CurrentUser() user: { id: string }) {
    return this.beanScore.claimDailyBonus(user.id);
  }

  @Get('leaderboard')
  leaderboard(
    @Query('cityId') cityId?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? parseInt(limit, 10) : 20;
    return this.beanScore.leaderboard(cityId, parsed);
  }
}
