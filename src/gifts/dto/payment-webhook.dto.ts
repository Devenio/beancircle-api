import { IsOptional, IsString, IsUUID } from 'class-validator';

export class PaymentWebhookDto {
  @IsUUID()
  giftId: string;

  @IsOptional()
  @IsString()
  paymentRef?: string;
}
