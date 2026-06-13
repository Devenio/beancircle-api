import { BugCategory, BugSeverity, BugStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/** Admin-facing filters for the support dashboard list endpoint. */
export class ListBugReportsDto {
  @IsOptional()
  @IsEnum(BugStatus)
  status?: BugStatus;

  @IsOptional()
  @IsEnum(BugCategory)
  category?: BugCategory;

  @IsOptional()
  @IsEnum(BugSeverity)
  severity?: BugSeverity;

  /** Filter by app version (matches BugReport.appInfo->>'appVersion'). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  appVersion?: string;

  /** Filter by device model (matches BugReport.deviceInfo->>'model'). */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  device?: string;

  /** Assigned support agent user id. Use "unassigned" to find unowned reports. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  assignee?: string;

  /** Free-text search over ticket number, title and description. */
  @IsOptional()
  @IsString()
  @MaxLength(140)
  q?: string;

  @IsOptional()
  @IsString()
  cursor?: string;
}
