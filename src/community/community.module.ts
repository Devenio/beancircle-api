import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

@Module({
  imports: [PostsModule],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
