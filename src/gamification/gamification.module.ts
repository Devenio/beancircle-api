import { Module } from '@nestjs/common';
import { ConnectionBadgesService } from './connection-badges.service';
import { SuggestionJobService } from './suggestion-job.service';

@Module({
  providers: [ConnectionBadgesService, SuggestionJobService],
  exports: [ConnectionBadgesService, SuggestionJobService],
})
export class GamificationModule {}
