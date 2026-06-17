import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const visibility = ['everyone', 'contacts', 'nobody'] as const;
const autoDownload = ['wifi', 'always', 'never'] as const;
const mediaQuality = ['standard', 'high'] as const;
const fontSize = ['small', 'medium', 'large'] as const;
const density = ['compact', 'comfortable', 'spacious'] as const;
const locationVisibility = ['exact', 'approximate', 'city', 'hidden'] as const;
const discoveryVisibility = ['everyone', 'friends_of_friends', 'hidden'] as const;

export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(visibility)
  lastSeenVisibility?: (typeof visibility)[number];

  @IsOptional()
  @IsIn(visibility)
  onlineStatusVisibility?: (typeof visibility)[number];

  @IsOptional()
  @IsBoolean()
  readReceipts?: boolean;

  @IsOptional()
  @IsIn(visibility)
  profileVisibility?: (typeof visibility)[number];

  @IsOptional()
  @IsIn(visibility)
  socialLinksDefaultVisibility?: (typeof visibility)[number];

  @IsOptional()
  @IsBoolean()
  showLastSeen?: boolean;

  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  messageNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  mentionNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  groupNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationSound?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationVibration?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  accentColor?: string;

  @IsOptional()
  @IsIn(fontSize)
  fontSize?: (typeof fontSize)[number];

  @IsOptional()
  @IsIn(density)
  messageDensity?: (typeof density)[number];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  chatWallpaper?: string;

  @IsOptional()
  @IsIn(autoDownload)
  autoDownloadMedia?: (typeof autoDownload)[number];

  @IsOptional()
  @IsIn(mediaQuality)
  mediaQuality?: (typeof mediaQuality)[number];

  @IsOptional()
  @IsBoolean()
  saveDrafts?: boolean;

  @IsOptional()
  @IsBoolean()
  linkPreviews?: boolean;

  @IsOptional()
  @IsBoolean()
  typingIndicators?: boolean;

  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(365)
  autoCleanupDays?: number;

  @IsOptional()
  @IsIn(locationVisibility)
  locationVisibility?: (typeof locationVisibility)[number];

  @IsOptional()
  @IsIn(discoveryVisibility)
  discoveryVisibility?: (typeof discoveryVisibility)[number];

  @IsOptional()
  @IsBoolean()
  showOnlineStatus?: boolean;
}
