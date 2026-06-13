import { Module } from '@nestjs/common';
import { CafeOsModule } from '../cafe-os/cafe-os.module';
import { ChallengesModule } from '../challenges/challenges.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { PassportController } from './passport.controller';
import { PassportService } from './passport.service';

@Module({
  imports: [
    ChallengesModule,
    NotificationsModule,
    CafeOsModule,
    PromotionsModule,
  ],
  controllers: [PassportController],
  providers: [PassportService],
  exports: [PassportService],
})
export class PassportModule {}
