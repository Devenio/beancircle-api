import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FriendsService } from './friends.service';

@Controller('friends')
export class FriendsController {
  constructor(private friendsService: FriendsService) {}

  @Post('request')
  sendRequest(
    @CurrentUser() user: { id: string },
    @Body('userId') userId: string,
  ) {
    return this.friendsService.sendRequest(user.id, userId);
  }

  @Post('accept')
  accept(
    @CurrentUser() user: { id: string },
    @Body('requestId') requestId: string,
  ) {
    return this.friendsService.acceptRequest(user.id, requestId);
  }

  @Post('reject')
  reject(
    @CurrentUser() user: { id: string },
    @Body('requestId') requestId: string,
  ) {
    return this.friendsService.rejectRequest(user.id, requestId);
  }

  @Delete('request')
  cancel(
    @CurrentUser() user: { id: string },
    @Query('userId') userId: string,
  ) {
    return this.friendsService.cancelRequest(user.id, userId);
  }

  @Delete('remove')
  remove(
    @CurrentUser() user: { id: string },
    @Query('userId') userId: string,
  ) {
    return this.friendsService.removeFriend(user.id, userId);
  }

  @Get('list')
  list(
    @CurrentUser() user: { id: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Math.min(parseInt(limit, 10) || 20, 50) : 20;
    return this.friendsService.listFriends(user.id, cursor, parsed);
  }

  @Get('requests')
  requests(@CurrentUser() user: { id: string }) {
    return this.friendsService.listRequests(user.id);
  }

  @Get('status')
  status(
    @CurrentUser() user: { id: string },
    @Query('userId') userId: string,
  ) {
    return this.friendsService.getRelationship(user.id, userId);
  }
}
