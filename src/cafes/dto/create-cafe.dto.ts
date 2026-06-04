import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCafeDto {
  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  @IsUUID()
  cityId: string;

  @IsUUID()
  countryId: string;

  @IsOptional()
  @IsBoolean()
  isPartner?: boolean;

  @IsOptional()
  @IsBoolean()
  bestCoffee?: boolean;

  @IsOptional()
  @IsBoolean()
  bestWorkspace?: boolean;

  @IsOptional()
  @IsBoolean()
  quiet?: boolean;

  @IsOptional()
  @IsBoolean()
  studyFriendly?: boolean;

  @IsOptional()
  @IsBoolean()
  fastWifi?: boolean;

  @IsOptional()
  @IsBoolean()
  outdoorSeating?: boolean;

  @IsOptional()
  @IsBoolean()
  dateFriendly?: boolean;

  @IsOptional()
  @IsBoolean()
  petFriendly?: boolean;

  @IsOptional()
  @IsNumber()
  workspaceScore?: number;
}
