import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CafesService } from './cafes.service';
import { CheckinsService } from '../checkins/checkins.service';

@Controller('cafes')
export class CafesController {
  constructor(
    private cafesService: CafesService,
    private checkinsService: CheckinsService,
  ) {}

  @Get()
  list(@Query('cityId') cityId?: string, @Query('q') q?: string) {
    return this.cafesService.list(cityId, q);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user?: { id: string }) {
    return this.cafesService.get(id, user?.id);
  }

  @Post(':id/follow')
  follow(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.cafesService.follow(user.id, id);
  }

  @Delete(':id/follow')
  unfollow(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.cafesService.unfollow(user.id, id);
  }

  @Post(':id/checkins')
  checkin(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.checkinsService.create(user.id, id);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() body: Record<string, unknown>) {
    return this.cafesService.create(body as Parameters<CafesService['create']>[0]);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.cafesService.update(id, body as Parameters<CafesService['update']>[1]);
  }
}
