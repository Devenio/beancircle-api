import { Controller, Delete, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LikesService } from './likes.service';

@Controller('likes')
export class LikesController {
  constructor(private likesService: LikesService) {}

  @Post('posts/:postId')
  likePost(
    @CurrentUser() user: { id: string },
    @Param('postId') postId: string,
  ) {
    return this.likesService.togglePost(user.id, postId);
  }

  @Delete('posts/:postId')
  unlikePost(
    @CurrentUser() user: { id: string },
    @Param('postId') postId: string,
  ) {
    return this.likesService.togglePost(user.id, postId);
  }

  @Post('reviews/:reviewId')
  likeReview(
    @CurrentUser() user: { id: string },
    @Param('reviewId') reviewId: string,
  ) {
    return this.likesService.toggleReview(user.id, reviewId);
  }

  @Delete('reviews/:reviewId')
  unlikeReview(
    @CurrentUser() user: { id: string },
    @Param('reviewId') reviewId: string,
  ) {
    return this.likesService.toggleReview(user.id, reviewId);
  }
}
