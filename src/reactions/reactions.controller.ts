import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ReactionEmoji } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReactionsService } from './reactions.service';

class SetReactionDto {
  @IsEnum(ReactionEmoji)
  emoji: ReactionEmoji;
}

@Controller('posts')
export class ReactionsController {
  constructor(private reactions: ReactionsService) {}

  @Get(':id/reactions')
  list(@Param('id') postId: string, @CurrentUser() user?: { id: string }) {
    return this.reactions.getPostReactions(postId, user?.id);
  }

  @Post(':id/reactions')
  set(
    @CurrentUser() user: { id: string },
    @Param('id') postId: string,
    @Body() dto: SetReactionDto,
  ) {
    return this.reactions.setPostReaction(user.id, postId, dto.emoji);
  }

  @Delete(':id/reactions')
  remove(@CurrentUser() user: { id: string }, @Param('id') postId: string) {
    return this.reactions.removePostReaction(user.id, postId);
  }
}
