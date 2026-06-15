import { Injectable } from '@nestjs/common';
import { BadgeCode, InterestSlug, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SetInterestsDto } from './dto/set-interests.dto';
import { TrackEventDto } from './dto/track-event.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';

/** Activation steps that come after the mandatory username gate, in order. */
export const ONBOARDING_STEPS = [
  'welcome',
  'interests',
  'avatar',
  'circle',
  'firstPost',
  'cafe',
  'achievement',
  'profile',
  'invite',
] as const;

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  /** Lazily create the FIRST_SIP badge definition (mirrors connection-badges). */
  private async ensureFirstSipBadge() {
    await this.prisma.badgeDefinition.upsert({
      where: { code: BadgeCode.FIRST_SIP },
      create: {
        code: BadgeCode.FIRST_SIP,
        name: 'First Sip',
        description: 'Joined BeanCircle and took your first sip',
        iconKey: 'coffee',
        threshold: 1,
        thresholdType: 'onboarding',
      },
      update: { name: 'First Sip' },
    });
  }

  private ensureProgress(userId: string) {
    return this.prisma.onboardingProgress.upsert({
      where: { userId },
      create: { userId, currentStep: 'welcome' },
      update: { lastActiveAt: new Date() },
    });
  }

  /** % of the profile filled in — drives the Step 8 progress bar + metrics. */
  private computeCompletion(
    user: {
      name?: string | null;
      bio?: string | null;
      avatarUrl?: string | null;
      favoriteCoffee?: string | null;
      website?: string | null;
      cityId?: string | null;
      socialLinks?: Prisma.JsonValue;
    },
    interestCount: number,
    hasAvatar: boolean,
  ) {
    const links = user.socialLinks as Record<string, string> | null;
    const signals = [
      !!user.name,
      !!user.bio,
      !!user.avatarUrl || hasAvatar,
      !!user.favoriteCoffee,
      !!user.website || !!(links && Object.keys(links).length),
      !!user.cityId,
      interestCount > 0,
    ];
    const filled = signals.filter(Boolean).length;
    return {
      filled,
      total: signals.length,
      percent: Math.round((filled / signals.length) * 100),
    };
  }

  async getOnboarding(userId: string) {
    const [progress, avatar, interests, user] = await Promise.all([
      this.ensureProgress(userId),
      this.prisma.beanAvatar.findUnique({ where: { userId } }),
      this.prisma.userInterest.findMany({ where: { userId } }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          name: true,
          bio: true,
          avatarUrl: true,
          favoriteCoffee: true,
          website: true,
          socialLinks: true,
          cityId: true,
        },
      }),
    ]);
    return {
      progress,
      avatar,
      interests: interests.map((i) => i.interest),
      completion: this.computeCompletion(
        user,
        interests.length,
        !!avatar,
      ),
    };
  }

  async updateProgress(userId: string, dto: UpdateOnboardingDto) {
    const current = await this.ensureProgress(userId);
    const completed = new Set(current.completedSteps);
    const skipped = new Set(current.skippedSteps);

    if (dto.completeStep) {
      completed.add(dto.completeStep);
      skipped.delete(dto.completeStep);
    }
    if (dto.skipStep) {
      skipped.add(dto.skipStep);
      completed.delete(dto.skipStep);
    }

    const timings = {
      ...((current.stepTimings as Record<string, number>) ?? {}),
      ...(dto.stepTimings ?? {}),
    };

    return this.prisma.onboardingProgress.update({
      where: { userId },
      data: {
        currentStep: dto.currentStep ?? current.currentStep,
        completedSteps: [...completed],
        skippedSteps: [...skipped],
        stepTimings: timings,
        lastActiveAt: new Date(),
      },
    });
  }

  async complete(userId: string) {
    await this.ensureFirstSipBadge();
    const [progress] = await this.prisma.$transaction([
      this.prisma.onboardingProgress.upsert({
        where: { userId },
        create: { userId, currentStep: 'invite', completedAt: new Date() },
        update: { completedAt: new Date(), lastActiveAt: new Date() },
      }),
      this.prisma.userBadge.upsert({
        where: {
          userId_badgeCode: { userId, badgeCode: BadgeCode.FIRST_SIP },
        },
        create: { userId, badgeCode: BadgeCode.FIRST_SIP },
        update: {},
      }),
    ]);
    return { completed: true, progress, badge: 'FIRST_SIP' };
  }

  async setInterests(userId: string, dto: SetInterestsDto) {
    const unique = [...new Set(dto.interests)] as InterestSlug[];
    await this.prisma.$transaction([
      this.prisma.userInterest.deleteMany({ where: { userId } }),
      this.prisma.userInterest.createMany({
        data: unique.map((interest) => ({ userId, interest })),
        skipDuplicates: true,
      }),
    ]);
    return { interests: unique };
  }

  getAvatar(userId: string) {
    return this.prisma.beanAvatar.findUnique({ where: { userId } });
  }

  async upsertAvatar(userId: string, dto: UpdateAvatarDto) {
    const data = {
      ...dto,
      isDefault: dto.isDefault ?? false,
    };
    return this.prisma.beanAvatar.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async trackEvent(userId: string, dto: TrackEventDto) {
    await this.prisma.onboardingEvent.create({
      data: {
        userId,
        step: dto.step,
        type: dto.type,
        timeSpentMs: dto.timeSpentMs,
      },
    });
    return { tracked: true };
  }
}
