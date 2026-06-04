import { IsString, MinLength } from 'class-validator';

export class GoogleExchangeDto {
  @IsString()
  @MinLength(8)
  code: string;
}
