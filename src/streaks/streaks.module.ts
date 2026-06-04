import { Global, Module } from '@nestjs/common';
import { StreaksController } from './streaks.controller';
import { StreakService } from './streaks.service';

@Global()
@Module({
  controllers: [StreaksController],
  providers: [StreakService],
  exports: [StreakService],
})
export class StreaksModule {}
