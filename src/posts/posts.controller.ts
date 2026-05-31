import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { PostType } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PostsService } from './posts.service';

class CreatePostDto {
  @IsEnum(PostType)
  type: PostType;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsUUID()
  cafeId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];
}

@Controller('posts')
export class PostsController {
  constructor(private postsService: PostsService) {}

  @Get('feed')
  feed(@CurrentUser() user: { id: string }, @Query() q: PaginationDto) {
    return this.postsService.getFeed(user.id, q.cursor, q.limit);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user?: { id: string }) {
    return this.postsService.getById(id, user?.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreatePostDto) {
    return this.postsService.create(user.id, dto);
  }

  @Post(':id/save')
  save(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.postsService.save(user.id, id);
  }

  @Delete(':id/save')
  unsave(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.postsService.unsave(user.id, id);
  }
}
