import { BugSeverity, BugStatus } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/** Admin update of a bug report's workflow fields. All fields optional. */
export class UpdateBugReportDto {
  @IsOptional()
  @IsEnum(BugStatus)
  status?: BugStatus;

  @IsOptional()
  @IsEnum(BugSeverity)
  severity?: BugSeverity;

  /** Assign to a support agent. Pass null to unassign. */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(64)
  assigneeId?: string | null;

  /** Version the fix shipped in (e.g. "2.14.0"). */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(64)
  fixVersion?: string | null;

  /** Mark this report as a duplicate of another ticket. Pass null to clear. */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(64)
  duplicateOfId?: string | null;
}
