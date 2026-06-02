import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsString, Min } from 'class-validator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminGuard } from '../common/guards/admin.guard';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { GiftsService } from './gifts.service';

class CreateGiftDto {
  @IsInt()
  @Min(1)
  amount: number;
}

class RedeemDto {
  @IsString()
  voucherCode: string;

  @IsString()
  cafeId: string;
}

@Controller('gifts')
export class GiftsController {
  constructor(private giftsService: GiftsService) {}

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateGiftDto) {
    return this.giftsService.create(user.id, dto.amount);
  }

  @Public()
  @Post('webhook/payment')
  webhook(
    @Headers('x-webhook-signature') signature: string | undefined,
    @Body() dto: PaymentWebhookDto,
  ) {
    this.giftsService.verifyWebhookSignature(signature, dto);
    return this.giftsService.completePayment(dto.giftId);
  }

  @Get(':id/voucher')
  voucher(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.giftsService.getVoucher(id, user.id);
  }

  @Post('redeem')
  redeem(
    @CurrentUser() user: { id: string },
    @Body() dto: RedeemDto,
  ) {
    return this.giftsService.redeem(dto.voucherCode, dto.cafeId, user.id);
  }

  @Get()
  @UseGuards(AdminGuard)
  list() {
    return this.giftsService.listAll();
  }
}
