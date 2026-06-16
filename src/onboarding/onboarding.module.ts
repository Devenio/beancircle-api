import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingFlowService } from './onboarding-flow.service';
import { OnboardingService } from './onboarding.service';

@Module({
  controllers: [OnboardingController],
  providers: [OnboardingService, OnboardingFlowService],
  exports: [OnboardingService, OnboardingFlowService],
})
export class OnboardingModule {}
