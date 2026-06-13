import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LoyaltyService } from './loyalty.service';
import { MarketingService } from './marketing.service';

/** Consumer-facing cafe endpoints (authenticated app users, not staff). */
@Controller('cafes')
export class CafePublicController {
  constructor(
    private marketing: MarketingService,
    private loyalty: LoyaltyService,
  ) {}

  @Get('loyalty/mine')
  myLoyalty(@CurrentUser() user: { id: string }) {
    return this.loyalty.myCards(user.id);
  }

  @Get(':id/announcements')
  announcements(@Param('id') cafeId: string) {
    return this.marketing.listPublished(cafeId);
  }

  @Get(':id/loyalty')
  loyaltyView(
    @CurrentUser() user: { id: string },
    @Param('id') cafeId: string,
  ) {
    return this.loyalty.consumerView(cafeId, user.id);
  }
}
