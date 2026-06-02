import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ChallengesService } from './challenges.service';

@Controller('challenges')
export class ChallengesController {
  constructor(private challenges: ChallengesService) {}

  @Get()
  list(
    @Query('cityId') cityId?: string,
    @CurrentUser() user?: { id: string; cityId?: string },
  ) {
    return this.challenges.listActive(cityId ?? user?.cityId, user?.id);
  }

  @Get('me')
  mine(@CurrentUser() user: { id: string }) {
    return this.challenges.myProgress(user.id);
  }
}
