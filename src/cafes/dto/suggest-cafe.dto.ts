import { IsNumber, IsOptional, IsString } from 'class-validator';

export class SuggestCafeDto {
  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
