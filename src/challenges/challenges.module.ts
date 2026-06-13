import { Module } from '@nestjs/common';
import { BeanScoreModule } from '../beanscore/beanscore.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';

@Module({
  imports: [BeanScoreModule, NotificationsModule],
  controllers: [ChallengesController],
  providers: [ChallengesService],
  exports: [ChallengesService],
})
export class ChallengesModule {}
