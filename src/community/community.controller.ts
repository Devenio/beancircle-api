import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CommunityService } from './community.service';

@Controller('community')
export class CommunityController {
  constructor(private community: CommunityService) {}

  @Get('feed')
  feed(
    @CurrentUser() user: { id: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Math.min(parseInt(limit, 10) || 20, 50) : 20;
    return this.community.activityFeed(user.id, cursor, parsed);
  }
}
