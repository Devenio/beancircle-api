import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class TrackEventDto {
  @IsString()
  @MaxLength(40)
  step: string;

  @IsIn(['viewed', 'skipped', 'completed'])
  type: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  timeSpentMs?: number;
}
