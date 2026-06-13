import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AddBugCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;

  /** Internal note (staff only) by default. Set false to reply to the reporter. */
  @IsOptional()
  @IsBoolean()
  internal?: boolean;
}
