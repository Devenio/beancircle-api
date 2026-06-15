import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { FeatureFlagsService } from './feature-flags.service';

@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private flags: FeatureFlagsService) {}

  /**
   * Effective flag map for the front-end to gate UI. Optionally scoped to a
   * cafe so per-cafe overrides apply. Public — flags only describe availability.
   */
  @Public()
  @Get()
  effective(@Query('cafeId') cafeId?: string) {
    return this.flags.getEffective(cafeId);
  }
}
