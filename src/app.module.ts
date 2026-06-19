import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validationSchema } from './config/validation.schema';
import { CafeOsModule } from './cafe-os/cafe-os.module';
import { ActivityModule } from './activity/activity.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { BeansModule } from './beans/beans.module';
import { CollectiblesModule } from './collectibles/collectibles.module';
import { SquadsModule } from './squads/squads.module';
import { StreaksModule } from './streaks/streaks.module';
import { CafesModule } from './cafes/cafes.module';
import { ChatModule } from './chat/chat.module';
import { CheckinsModule } from './checkins/checkins.module';
import { CommentsModule } from './comments/comments.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { DesignsModule } from './designs/designs.module';
import { BeanScoreModule } from './beanscore/beanscore.module';
import { CommunityModule } from './community/community.module';
import { DiscoverModule } from './discover/discover.module';
import { DiscoverPeopleModule } from './discover-people/discover-people.module';
import { DiscoverWorldModule } from './discover-world/discover-world.module';
import { FriendsModule } from './friends/friends.module';
import { LocationModule } from './location/location.module';
import { ReactionsModule } from './reactions/reactions.module';
import { WorkModule } from './work/work.module';
import { MenusModule } from './menus/menus.module';
import { OwnerModule } from './owner/owner.module';
import { ChallengesModule } from './challenges/challenges.module';
import { EventsModule } from './events/events.module';
import { GrowthModule } from './growth/growth.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { GiftsModule } from './gifts/gifts.module';
import { PromotionsModule } from './promotions/promotions.module';
import { ScanModule } from './scan/scan.module';
import { HomeModule } from './home/home.module';
import { PassportModule } from './passport/passport.module';
import { LikesModule } from './likes/likes.module';
import { ReportsModule } from './reports/reports.module';
import { BugReportsModule } from './bug-reports/bug-reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RedisModule } from './redis/redis.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SearchModule } from './search/search.module';
import { UploadsModule } from './uploads/uploads.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PrismaModule,
    RedisModule,
    ActivityModule,
    StreaksModule,
    CollectiblesModule,
    SquadsModule,
    AuthModule,
    UsersModule,
    SettingsModule,
    CafesModule,
    PostsModule,
    BeansModule,
    CommentsModule,
    LikesModule,
    ReviewsModule,
    CheckinsModule,
    SearchModule,
    ChatModule,
    NotificationsModule,
    GiftsModule,
    PromotionsModule,
    ScanModule,
    HomeModule,
    PassportModule,
    DiscoverModule,
    DiscoverPeopleModule,
    DiscoverWorldModule,
    FriendsModule,
    LocationModule,
    BeanScoreModule,
    CommunityModule,
    ReactionsModule,
    WorkModule,
    OwnerModule,
    CafeOsModule,
    MenusModule,
    ChallengesModule,
    EventsModule,
    GrowthModule,
    OnboardingModule,
    ReportsModule,
    BugReportsModule,
    AdminModule,
    UploadsModule,
    RealtimeModule,
    FeatureFlagsModule,
    SuperAdminModule,
    DesignsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
