import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CollectiblesService } from './collectibles.service';

@Controller('collectibles')
export class CollectiblesController {
  constructor(private collectibles: CollectiblesService) {}

  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.collectibles.getMine(user.id);
  }

  @Get('user/:id/summary')
  summary(@Param('id') id: string) {
    return this.collectibles.summaryFor(id);
  }
}
