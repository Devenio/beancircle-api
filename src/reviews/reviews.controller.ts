import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';

class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];
}

@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Post('cafes/:cafeId')
  create(
    @CurrentUser() user: { id: string },
    @Param('cafeId') cafeId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(user.id, cafeId, dto);
  }

  @Get('cafes/:cafeId')
  list(@Param('cafeId') cafeId: string) {
    return this.reviewsService.listByCafe(cafeId);
  }
}
