import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CheckinsService } from './checkins.service';

@Controller('checkins')
export class CheckinsController {
  constructor(private checkinsService: CheckinsService) {}

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body('cafeId') cafeId: string,
  ) {
    return this.checkinsService.create(user.id, cafeId);
  }

  @Get()
  list(@CurrentUser() user?: { id: string }) {
    return this.checkinsService.list(user?.id);
  }
}
