import { Module } from '@nestjs/common';
import { ChallengesModule } from '../challenges/challenges.module';
import { PassportController } from './passport.controller';
import { PassportService } from './passport.service';

@Module({
  imports: [ChallengesModule],
  controllers: [PassportController],
  providers: [PassportService],
  exports: [PassportService],
})
export class PassportModule {}
