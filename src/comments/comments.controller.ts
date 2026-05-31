import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CommentsService } from './comments.service';

class CommentBodyDto {
  @IsString()
  @MinLength(1)
  body: string;
}

@Controller()
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Get('posts/:postId/comments')
  listPost(@Param('postId') postId: string) {
    return this.commentsService.listForPost(postId);
  }

  @Post('posts/:postId/comments')
  createPost(
    @CurrentUser() user: { id: string },
    @Param('postId') postId: string,
    @Body() dto: CommentBodyDto,
  ) {
    return this.commentsService.createOnPost(user.id, postId, dto.body);
  }

  @Get('reviews/:reviewId/comments')
  listReview(@Param('reviewId') reviewId: string) {
    return this.commentsService.listForReview(reviewId);
  }

  @Post('reviews/:reviewId/comments')
  createReview(
    @CurrentUser() user: { id: string },
    @Param('reviewId') reviewId: string,
    @Body() dto: CommentBodyDto,
  ) {
    return this.commentsService.createOnReview(user.id, reviewId, dto.body);
  }
}
