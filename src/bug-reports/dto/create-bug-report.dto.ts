import { BugCategory } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BugAttachmentInput {
  @IsString()
  @IsIn(['SCREENSHOT', 'ANNOTATION', 'REPLAY', 'LOG', 'VIDEO', 'OTHER'])
  kind: string;

  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}

export class CreateBugReportDto {
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  title: string;

  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  description: string;

  @IsEnum(BugCategory)
  category: BugCategory;

  /** Current route / page the user was on (e.g. "/chat/123"). */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  route?: string;

  /** Public URL of the captured screenshot (uploaded via /uploads/presign). */
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  screenshotUrl?: string;

  /** Public URL of the recorded session-replay bundle. */
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  replayUrl?: string;

  /** Device model, OS, screen size, language, timezone, etc. */
  @IsOptional()
  @IsObject()
  deviceInfo?: Record<string, unknown>;

  /** App version, build number, API environment, etc. */
  @IsOptional()
  @IsObject()
  appInfo?: Record<string, unknown>;

  /** Navigation stack, network type, performance metrics, etc. */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  /** Last N app logs, JS errors, API failures, console warnings. */
  @IsOptional()
  @IsArray()
  logs?: unknown[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BugAttachmentInput)
  attachments?: BugAttachmentInput[];

  /**
   * Client-generated idempotency key so the offline queue can retry a submit
   * without creating duplicate tickets.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientToken?: string;
}
