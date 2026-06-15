import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** Discrete bean-avatar option keys. The client renders the layered SVG. */
export class UpdateAvatarDto {
  @IsOptional() @IsString() @MaxLength(30) bg?: string;
  @IsOptional() @IsString() @MaxLength(30) skin?: string;
  @IsOptional() @IsString() @MaxLength(30) hair?: string;
  @IsOptional() @IsString() @MaxLength(30) glasses?: string;
  @IsOptional() @IsString() @MaxLength(30) beard?: string;
  @IsOptional() @IsString() @MaxLength(30) outfit?: string;
  @IsOptional() @IsString() @MaxLength(30) accessory?: string;
  @IsOptional() @IsString() @MaxLength(30) coffeeCup?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
