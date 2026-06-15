import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SquadCategory } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireFeature } from '../common/decorators/feature-flag.decorator';
import { FeatureFlagGuard } from '../common/guards/feature-flag.guard';
import { CreateSquadDto, SquadMessageDto } from './dto/squad.dto';
import { SquadsService } from './squads.service';

@Controller('squads')
@RequireFeature('squads')
@UseGuards(FeatureFlagGuard)
export class SquadsController {
  constructor(private squads: SquadsService) {}

  @Get()
  list(
    @Query('cityId') cityId?: string,
    @Query('category') category?: SquadCategory,
    @Query('q') q?: string,
  ) {
    return this.squads.list({ cityId, category, q });
  }

  @Get('mine')
  mine(@CurrentUser() user: { id: string }) {
    return this.squads.mine(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateSquadDto) {
    return this.squads.create(user.id, dto);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user?: { id: string }) {
    return this.squads.get(id, user?.id);
  }

  @Post(':id/join')
  join(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.squads.join(user.id, id);
  }

  @Delete(':id/join')
  leave(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.squads.leave(user.id, id);
  }

  @Get(':id/members')
  members(@Param('id') id: string) {
    return this.squads.members(id);
  }

  @Get(':id/leaderboard')
  leaderboard(@Param('id') id: string) {
    return this.squads.leaderboard(id);
  }

  @Get(':id/messages')
  messages(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.squads.messages(user.id, id, cursor);
  }

  @Post(':id/messages')
  send(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: SquadMessageDto,
  ) {
    return this.squads.sendMessage(user.id, id, dto);
  }
}
