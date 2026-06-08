import { Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { InterestSlug } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DiscoverPeopleService } from './discover-people.service';
import { DiscoverScanService } from './discover-scan.service';

@Controller('discover')
export class DiscoverPeopleController {
  constructor(
    private discoverPeople: DiscoverPeopleService,
    private discoverScan: DiscoverScanService,
  ) {}

  @Post('scan')
  scan(
    @CurrentUser() user: { id: string },
    @Query('radiusKm') radiusKm?: string,
  ) {
    return this.discoverScan.startScan(
      user.id,
      radiusKm ? parseFloat(radiusKm) : 5,
    );
  }

  @Delete('scan')
  cancelScan(@CurrentUser() user: { id: string }) {
    this.discoverScan.cancelScan(user.id);
    return { ok: true };
  }

  @Get('nearby')
  nearby(
    @CurrentUser() user: { id: string },
    @Query('radiusKm') radiusKm?: string,
    @Query('interests') interests?: string | string[],
    @Query('activity') activity?: 'online' | 'today' | 'week',
    @Query('relationship') relationship?: 'friends_only' | 'not_friends' | 'suggested',
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedInterests = parseInterests(interests);
    return this.discoverPeople.nearby(user.id, {
      radiusKm: radiusKm ? parseFloat(radiusKm) : undefined,
      interests: parsedInterests,
      activity,
      relationship,
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('suggestions')
  suggestions(
    @CurrentUser() user: { id: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.discoverPeople.suggestions(
      user.id,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get('map')
  map(
    @CurrentUser() user: { id: string },
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    return this.discoverPeople.map(
      user.id,
      parseFloat(lat),
      parseFloat(lng),
      radiusKm ? parseFloat(radiusKm) : 5,
    );
  }
}

function parseInterests(raw?: string | string[]): InterestSlug[] | undefined {
  if (!raw) return undefined;
  const list = Array.isArray(raw) ? raw : raw.split(',');
  const valid = Object.values(InterestSlug);
  return list
    .map((s) => s.toUpperCase() as InterestSlug)
    .filter((s) => valid.includes(s));
}
