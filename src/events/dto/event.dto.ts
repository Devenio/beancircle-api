import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EventType } from '@prisma/client';

export class CreateEventDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  description: string;

  @IsEnum(EventType)
  type: EventType;

  @IsOptional()
  @IsUUID()
  cafeId?: string;

  @IsOptional()
  @IsUUID()
  cityId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  locationLabel?: string;

  @IsOptional()
  @IsString()
  coverUrl?: string;

  @IsISO8601()
  startsAt: string;

  @IsISO8601()
  endsAt: string;
}

export class SetReminderDto {
  @IsOptional()
  @IsISO8601()
  remindAt?: string;
}
