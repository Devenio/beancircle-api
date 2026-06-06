import { Module } from '@nestjs/common';
import { FriendsModule } from '../friends/friends.module';
import { GamificationModule } from '../gamification/gamification.module';
import { LocationModule } from '../location/location.module';
import { RedisModule } from '../redis/redis.module';
import { DiscoverMatchService } from './discover-match.service';
import { DiscoverPeopleController } from './discover-people.controller';
import { DiscoverPeopleService } from './discover-people.service';

@Module({
  imports: [LocationModule, FriendsModule, RedisModule, GamificationModule],
  controllers: [DiscoverPeopleController],
  providers: [DiscoverPeopleService, DiscoverMatchService],
  exports: [DiscoverPeopleService],
})
export class DiscoverPeopleModule {}
