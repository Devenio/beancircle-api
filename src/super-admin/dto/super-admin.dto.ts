import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CafeOwnershipClaimStatus,
  CafeSuggestionStatus,
  MenuTheme,
  UserRole,
  UserStatus,
} from '@prisma/client';

export class SetGlobalFlagDto {
  @IsBoolean()
  enabled: boolean;
}

export class SetCafeFlagDto {
  // null clears the override and falls back to the global value.
  @IsOptional()
  @IsBoolean()
  enabled: boolean | null;
}

export class SetStepDto {
  @IsBoolean()
  enabled: boolean;
}

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;

  @IsOptional()
  @IsString()
  note?: string;

  // For SUSPENDED: ISO date until which the suspension lasts.
  @IsOptional()
  @IsString()
  suspendedUntil?: string;
}

export class UpdateCafeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsBoolean() isPartner?: boolean;
}

// ---------------- Menu templates ----------------

export class TemplateItemDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsInt() @Min(0) price: number;
  @IsOptional() @IsInt() @Min(0) discountPrice?: number;
  @IsOptional() @IsInt() @Min(0) calories?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) ingredients?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) allergens?: string[];
  @IsOptional() @IsInt() @Min(0) prepTimeMin?: number;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];
  @IsOptional() @IsString() videoUrl?: string;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
  @IsOptional() @IsInt() order?: number;
}

export class TemplateCategoryDto {
  @IsString() name: string;
  @IsOptional() @IsInt() order?: number;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateItemDto)
  items?: TemplateItemDto[];
}

export class UpsertTemplateDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() previewImageUrl?: string;
  @IsOptional() @IsString() welcomeTitle?: string;
  @IsOptional() @IsString() welcomeMessage?: string;
  @IsOptional() @IsString() accentColor?: string;
  @IsOptional() @IsEnum(MenuTheme) theme?: MenuTheme;
  @IsOptional() themeConfig?: unknown;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateCategoryDto)
  categories?: TemplateCategoryDto[];
}

export class ApplyTemplateDto {
  // Optional desired public slug for the cafe menu; auto-generated if omitted.
  @IsOptional() @IsString() slug?: string;
  // Publish the menu immediately after applying.
  @IsOptional() @IsBoolean() publish?: boolean;
  // When true (default) also clone the template's starter categories/items.
  // When false, only the design (theme/colors/welcome) is applied.
  @IsOptional() @IsBoolean() includeContent?: boolean;
}

export class AssignTemplateDto {
  @IsArray()
  @IsString({ each: true })
  cafeIds: string[];
}

export class UpdateSuggestionDto {
  @IsEnum(CafeSuggestionStatus)
  status: CafeSuggestionStatus;

  @IsOptional()
  @IsString()
  adminNote?: string;

  @IsOptional()
  @IsUUID()
  cityId?: string;
}

export class UpdateClaimDto {
  @IsEnum(CafeOwnershipClaimStatus)
  status: CafeOwnershipClaimStatus;

  @IsOptional()
  @IsString()
  adminNote?: string;
}

export class SetCafeOwnerDto {
  @IsUUID()
  userId: string;
}
