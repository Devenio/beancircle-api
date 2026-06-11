import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { BeanReactionType, BeanType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { BeansService } from './beans.service';

class BeanMediaDto {
  @IsOptional()
  @IsIn(['IMAGE', 'VIDEO', 'GIF'])
  type?: 'IMAGE' | 'VIDEO' | 'GIF';

  @IsString()
  url: string;
}

class BeanPollDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  options: string[];

  @IsOptional()
  @IsISO8601()
  endsAt?: string;
}

class CreateBeanDto {
  @IsOptional()
  @IsEnum(BeanType)
  type?: BeanType;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @IsOptional()
  @IsUUID()
  cafeId?: string;

  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsOptional()
  @IsUUID()
  squadId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  locationLabel?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkUrl?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsUUID()
  quotedBeanId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => BeanMediaDto)
  media?: BeanMediaDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => BeanPollDto)
  poll?: BeanPollDto;
}

class SetBeanReactionDto {
  @IsEnum(BeanReactionType)
  type: BeanReactionType;
}

class VotePollDto {
  @IsUUID()
  optionId: string;
}

@Controller('beans')
export class BeansController {
  constructor(private beans: BeansService) {}

  @Get('feed')
  feed(@CurrentUser() user: { id: string }, @Query() q: PaginationDto) {
    return this.beans.getHomeFeed(user.id, q.cursor, q.limit);
  }

  @Get('trending')
  trending(@CurrentUser() user: { id: string }, @Query() q: PaginationDto) {
    return this.beans.getTrending(user.id, q.cursor, q.limit);
  }

  @Get('local')
  local(@CurrentUser() user: { id: string }, @Query() q: PaginationDto) {
    return this.beans.getLocal(user.id, q.cursor, q.limit);
  }

  @Get('friends')
  friends(@CurrentUser() user: { id: string }, @Query() q: PaginationDto) {
    return this.beans.getFriends(user.id, q.cursor, q.limit);
  }

  @Get('topics')
  topics() {
    return this.beans.getTrendingTopics();
  }

  @Get('cafe/:cafeId')
  forCafe(
    @CurrentUser() user: { id: string },
    @Param('cafeId') cafeId: string,
    @Query() q: PaginationDto,
  ) {
    return this.beans.getForCafe(cafeId, user?.id, q.cursor, q.limit);
  }

  @Get('community/:squadId')
  forSquad(
    @CurrentUser() user: { id: string },
    @Param('squadId') squadId: string,
    @Query() q: PaginationDto,
  ) {
    return this.beans.getForSquad(squadId, user?.id, q.cursor, q.limit);
  }

  @Get('event/:eventId')
  forEvent(
    @CurrentUser() user: { id: string },
    @Param('eventId') eventId: string,
    @Query() q: PaginationDto,
  ) {
    return this.beans.getForEvent(eventId, user?.id, q.cursor, q.limit);
  }

  @Get('user/:username')
  forUser(
    @CurrentUser() user: { id: string },
    @Param('username') username: string,
    @Query() q: PaginationDto,
  ) {
    return this.beans.getForUser(username, user?.id, q.cursor, q.limit);
  }

  @Get('hashtag/:tag')
  forHashtag(
    @CurrentUser() user: { id: string },
    @Param('tag') tag: string,
    @Query() q: PaginationDto,
  ) {
    return this.beans.getByHashtag(tag, user?.id, q.cursor, q.limit);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user?: { id: string }) {
    return this.beans.getById(id, user?.id);
  }

  @Get(':id/replies')
  replies(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Query() q: PaginationDto,
  ) {
    return this.beans.getReplies(id, user?.id, q.cursor, q.limit);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateBeanDto) {
    return this.beans.create(user.id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.beans.delete(user.id, id);
  }

  @Post(':id/rebean')
  rebean(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.beans.rebean(user.id, id);
  }

  @Delete(':id/rebean')
  unrebean(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.beans.unrebean(user.id, id);
  }

  @Post(':id/reactions')
  react(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: SetBeanReactionDto,
  ) {
    return this.beans.react(user.id, id, dto.type);
  }

  @Delete(':id/reactions')
  unreact(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.beans.unreact(user.id, id);
  }

  @Post(':id/poll/vote')
  vote(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: VotePollDto,
  ) {
    return this.beans.votePoll(user.id, id, dto.optionId);
  }
}
