import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  AnnouncementKind,
  CafeRole,
  EventType,
  LoyaltyProgramKind,
  QrCodeKind,
} from '@prisma/client';

// ---------- Cafe ----------

export class CreateCafeDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsString()
  @MaxLength(255)
  address: string;

  @IsString()
  cityId: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logoUrl?: string;
}

export class UpdateCafeProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters, numbers, and hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  coverUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;

  @IsOptional()
  @IsObject()
  openingHours?: Record<string, { open: string; close: string; closed?: boolean }>;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  wifiName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  wifiPassword?: string;

  @IsOptional()
  @IsBoolean()
  isPartner?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gallery?: string[];
}

// ---------- Staff ----------

export class InviteStaffDto {
  @IsString()
  @MaxLength(64)
  username: string;

  @IsEnum(CafeRole)
  role: CafeRole;
}

export class UpdateStaffRoleDto {
  @IsEnum(CafeRole)
  role: CafeRole;
}

export class RespondInviteDto {
  @IsBoolean()
  accept: boolean;
}

// ---------- Tables & QR ----------

export class CreateTableDto {
  @IsString()
  @MaxLength(64)
  name: string;
}

export class RenameTableDto {
  @IsString()
  @MaxLength(64)
  name: string;
}

export class ReorderDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}

export class CreateQrDto {
  @IsEnum(QrCodeKind)
  kind: QrCodeKind;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsString()
  eventId?: string;
}

export class PublicScanDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;
}

// ---------- CRM ----------

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isVip?: boolean;
}

// ---------- Loyalty ----------

export class UpsertLoyaltyProgramDto {
  @IsEnum(LoyaltyProgramKind)
  kind: LoyaltyProgramKind;

  @IsString()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  goal: number;

  @IsString()
  @MaxLength(120)
  rewardLabel: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RedeemLoyaltyDto {
  @IsString()
  userId: string;
}

// ---------- Marketing ----------

export class UpsertAnnouncementDto {
  @IsEnum(AnnouncementKind)
  kind: AnnouncementKind;

  @IsString()
  @MaxLength(120)
  title: string;

  @IsString()
  @MaxLength(2000)
  body: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  publishNow?: boolean;
}

// ---------- Events ----------

export class CreateCafeEventDto {
  @IsString()
  @MaxLength(120)
  title: string;

  @IsString()
  @MaxLength(2000)
  description: string;

  @IsEnum(EventType)
  type: EventType;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  locationLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  coverUrl?: string;

  @IsISO8601()
  startsAt: string;

  @IsISO8601()
  endsAt: string;
}

// ---------- Analytics ----------

export class AnalyticsRangeDto {
  @IsOptional()
  @IsIn(['7d', '30d', '90d'])
  range?: '7d' | '30d' | '90d';
}
