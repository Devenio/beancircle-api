import { Module } from '@nestjs/common';
import { DiscoverPeopleModule } from '../discover-people/discover-people.module';
import { LocationModule } from '../location/location.module';
import { RedisModule } from '../redis/redis.module';
import { CafeHeatService } from './cafe-heat.service';
import { DiscoverWorldController } from './discover-world.controller';
import { DiscoverWorldService } from './discover-world.service';

@Module({
  imports: [LocationModule, RedisModule, DiscoverPeopleModule],
  controllers: [DiscoverWorldController],
  providers: [DiscoverWorldService, CafeHeatService],
  exports: [DiscoverWorldService, CafeHeatService],
})
export class DiscoverWorldModule {}
