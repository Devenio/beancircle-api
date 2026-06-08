import { Module, forwardRef } from '@nestjs/common';
import { FriendsModule } from '../friends/friends.module';
import { GamificationModule } from '../gamification/gamification.module';
import { LocationModule } from '../location/location.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { RedisModule } from '../redis/redis.module';
import { DiscoverMatchService } from './discover-match.service';
import { DiscoverPeopleController } from './discover-people.controller';
import { DiscoverPeopleService } from './discover-people.service';
import { DiscoverScanService } from './discover-scan.service';

@Module({
  imports: [
    LocationModule,
    FriendsModule,
    RedisModule,
    GamificationModule,
    forwardRef(() => RealtimeModule),
  ],
  controllers: [DiscoverPeopleController],
  providers: [DiscoverPeopleService, DiscoverMatchService, DiscoverScanService],
  exports: [DiscoverPeopleService, DiscoverScanService],
})
export class DiscoverPeopleModule {}
