import { IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class PassportCheckinDto {
  @IsOptional()
  @IsUUID()
  cafeId?: string;

  @IsOptional()
  @IsString()
  checkinCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}
