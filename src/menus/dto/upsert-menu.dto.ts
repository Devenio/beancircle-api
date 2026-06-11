import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class MenuItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

export class MenuCategoryDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemDto)
  items: MenuItemDto[];
}

export class UpsertMenuDto {
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters, numbers, and hyphens',
  })
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  welcomeTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  welcomeMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  welcomeImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  accentColor?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuCategoryDto)
  categories: MenuCategoryDto[];
}
