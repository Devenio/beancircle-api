import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ActivityService } from './activity.service';

@Controller('activity')
export class ActivityController {
  constructor(private activity: ActivityService) {}

  @Get('feed')
  feed(
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const take = Math.min(Math.max(parseInt(limit ?? '20', 10) || 20, 1), 50);
    const skip = Math.max(parseInt(offset ?? '0', 10) || 0, 0);
    return this.activity.feed(user.id, take, skip);
  }

  @Post(':id/cheer')
  cheer(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.activity.cheer(user.id, id);
  }
}
