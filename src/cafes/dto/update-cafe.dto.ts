import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateCafeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

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
