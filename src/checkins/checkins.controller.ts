import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateCheckinDto } from './dto/create-checkin.dto';
import { CheckinsService } from './checkins.service';

@Controller('checkins')
export class CheckinsController {
  constructor(private checkinsService: CheckinsService) {}

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateCheckinDto,
  ) {
    return this.checkinsService.create(user.id, dto.cafeId);
  }

  @Get()
  list(@CurrentUser() user?: { id: string }) {
    return this.checkinsService.list(user?.id);
  }
}
