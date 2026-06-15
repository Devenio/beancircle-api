import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOnboardingDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  currentStep?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  completeStep?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  skipStep?: string;

  /** Map of step key -> milliseconds spent; merged into stored timings. */
  @IsOptional()
  stepTimings?: Record<string, number>;
}
