import { IsUUID } from 'class-validator';

export class CreateCheckinDto {
  @IsUUID()
  cafeId: string;
}
