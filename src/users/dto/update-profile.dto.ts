import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

function normalizeUsername(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

/** Platforms with brand icons + first-class treatment in the editor. */
export const SOCIAL_PLATFORMS = [
  'instagram',
  'x',
  'telegram',
  'tiktok',
  'youtube',
  'github',
  'linkedin',
  'facebook',
  'whatsapp',
  'threads',
  'discord',
  'website',
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

const linkVisibility = ['everyone', 'contacts', 'nobody'] as const;

export class SocialLinkDto {
  @IsIn([...SOCIAL_PLATFORMS, 'custom'])
  platform: string;

  @IsString()
  @IsUrl(
    { require_protocol: true, require_valid_protocol: true },
    { message: 'url must be a valid http(s) URL' },
  )
  @MaxLength(500)
  url: string;

  /** Required for custom links (no brand icon to label the row otherwise). */
  @ValidateIf((o) => o.platform === 'custom')
  @IsNotEmpty({ message: 'label is required for custom links' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

  @IsOptional()
  @IsIn(linkVisibility)
  visibility?: (typeof linkVisibility)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  order?: number;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeUsername(value))
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'username must contain only lowercase letters, numbers, and underscores',
  })
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @IsOptional()
  @IsUUID()
  cityId?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  favoriteCoffee?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  /**
   * Structured social links. Stored as JSON on `User.socialLinks`.
   * Each entry may carry its own `visibility`; links without one fall back to
   * the user's `socialLinksDefaultVisibility` setting at read time.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks?: SocialLinkDto[];
}
