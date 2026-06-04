import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DiscoverFilterKey, DiscoverService } from './discover.service';

@Controller('discover')
export class DiscoverController {
  constructor(private discoverService: DiscoverService) {}

  @Get()
  list(
    @Query('cityId') cityId?: string,
    @Query('q') q?: string,
    @Query('sort') sort?: 'trending' | 'rating' | 'new',
    @Query('filter') filter?: string | string[],
    @Query('limit') limit?: string,
    @CurrentUser() user?: { id: string },
  ) {
    const filters = this.parseFilters(filter);
    const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 30, 50) : 30;
    return this.discoverService.query(
      cityId,
      filters,
      q,
      sort ?? 'trending',
      parsedLimit,
    );
  }

  @Get('sections')
  sections(
    @Query('cityId') cityId?: string,
    @CurrentUser() user?: { id: string },
  ) {
    return this.discoverService.sections(cityId, user?.id);
  }

  private parseFilters(raw?: string | string[]): DiscoverFilterKey[] {
    const keys: DiscoverFilterKey[] = [
      'bestCoffee',
      'bestWorkspace',
      'quiet',
      'studyFriendly',
      'fastWifi',
      'outdoorSeating',
      'dateFriendly',
      'petFriendly',
    ];
    const list = Array.isArray(raw) ? raw : raw ? raw.split(',') : [];
    return list.filter((f): f is DiscoverFilterKey =>
      keys.includes(f as DiscoverFilterKey),
    );
  }
}
