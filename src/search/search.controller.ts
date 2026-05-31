import { Controller, Get, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get()
  search(
    @Query('q') q: string,
    @Query('type') type?: 'users' | 'cafes' | 'all',
    @Query('cityId') cityId?: string,
  ) {
    return this.searchService.search(q ?? '', type ?? 'all', cityId);
  }
}
