import { IsBoolean, IsOptional } from 'class-validator';

export class DeleteScopeDto {
  @IsOptional()
  @IsBoolean()
  forEveryone?: boolean;
}
