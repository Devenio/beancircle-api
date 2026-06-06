import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';

@Module({
  imports: [RedisModule],
  controllers: [LocationController],
  providers: [LocationService],
  exports: [LocationService],
})
export class LocationModule {}
