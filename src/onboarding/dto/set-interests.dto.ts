import { InterestSlug } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsEnum } from 'class-validator';

export class SetInterestsDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsEnum(InterestSlug, { each: true })
  interests: InterestSlug[];
}
