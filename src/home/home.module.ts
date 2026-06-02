import { Module } from '@nestjs/common';
import { CafesModule } from '../cafes/cafes.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PostsModule } from '../posts/posts.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [PostsModule, CafesModule, NotificationsModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
