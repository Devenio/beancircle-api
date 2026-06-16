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
import { CheckinsService } from '../checkins/checkins.service';
import { CreateCafeDto } from './dto/create-cafe.dto';
import { SuggestCafeDto } from './dto/suggest-cafe.dto';
import { UpdateCafeDto } from './dto/update-cafe.dto';
import { CafesService } from './cafes.service';

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

  @Post('suggest')
  suggest(@CurrentUser() user: { id: string }, @Body() dto: SuggestCafeDto) {
    return this.cafesService.suggest(user.id, dto);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateCafeDto) {
    return this.cafesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateCafeDto) {
    return this.cafesService.update(id, dto);
  }
}
