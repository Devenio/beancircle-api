import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DiscoverWorldService } from './discover-world.service';

@Controller('discover')
export class DiscoverWorldController {
  constructor(private discoverWorld: DiscoverWorldService) {}

  @Get('world')
  world(
    @CurrentUser() user: { id: string },
    @Query('radiusKm') radiusKm?: string,
  ) {
    const parsed = radiusKm ? parseFloat(radiusKm) : 5;
    const safe = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 0.5), 50)
      : 5;
    return this.discoverWorld.getWorld(user.id, safe);
  }
}
