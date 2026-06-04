import { Controller, Get, Post } from '@nestjs/common';
import { StreakType } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StreakService } from './streaks.service';

@Controller('streaks')
export class StreaksController {
  constructor(private streaks: StreakService) {}

  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.streaks.getMine(user.id);
  }

  /** Called on app open to register a daily-visit streak. */
  @Post('visit')
  visit(@CurrentUser() user: { id: string }) {
    return this.streaks.touch(user.id, StreakType.DAILY_VISIT);
  }
}
