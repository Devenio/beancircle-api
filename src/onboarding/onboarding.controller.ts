import { Body, Controller, Get, Patch, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { SetInterestsDto } from './dto/set-interests.dto';
import { TrackEventDto } from './dto/track-event.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
export class OnboardingController {
  constructor(private onboarding: OnboardingService) {}

  /** Active, ordered onboarding step keys. Public — only describes the flow. */
  @Public()
  @Get('flow')
  getFlow() {
    return this.onboarding.getActiveFlow();
  }

  @Get('me')
  getMe(@CurrentUser() user: { id: string }) {
    return this.onboarding.getOnboarding(user.id);
  }

  @Patch('me')
  update(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateOnboardingDto,
  ) {
    return this.onboarding.updateProgress(user.id, dto);
  }

  @Post('complete')
  complete(@CurrentUser() user: { id: string }) {
    return this.onboarding.complete(user.id);
  }

  @Put('interests')
  setInterests(
    @CurrentUser() user: { id: string },
    @Body() dto: SetInterestsDto,
  ) {
    return this.onboarding.setInterests(user.id, dto);
  }

  @Get('avatar')
  getAvatar(@CurrentUser() user: { id: string }) {
    return this.onboarding.getAvatar(user.id);
  }

  @Put('avatar')
  upsertAvatar(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateAvatarDto,
  ) {
    return this.onboarding.upsertAvatar(user.id, dto);
  }

  @Post('events')
  trackEvent(@CurrentUser() user: { id: string }, @Body() dto: TrackEventDto) {
    return this.onboarding.trackEvent(user.id, dto);
  }
}
