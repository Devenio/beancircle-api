import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class SuggestCafeDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(500)
  address: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
