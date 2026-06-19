import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  CAFE_EDIT_ROLES,
  CafeRoles,
} from '../common/decorators/cafe-roles.decorator';
import { CafeStaffGuard } from '../common/guards/cafe-staff.guard';
import { DesignsService } from './designs.service';
import { SetDesignSelectionDto } from './dto/designs.dto';

/**
 * Layer 3 — cafe owner panel. A cafe only ever sees the designs the admin has
 * whitelisted for it (plus the always-available defaults), and can pick one
 * design for its menu and one for its welcome screen.
 */
@Controller('cafe-os/cafes/:cafeId/designs')
@UseGuards(CafeStaffGuard)
export class DesignsController {
  constructor(private designs: DesignsService) {}

  /** Designs available to this cafe, split by type, plus current selection. */
  @Get()
  available(@Param('cafeId') cafeId: string) {
    return this.designs.availableForCafe(cafeId);
  }

  /** Save the cafe's menu / welcome design choice. */
  @Patch('selection')
  @CafeRoles(...CAFE_EDIT_ROLES)
  select(
    @Param('cafeId') cafeId: string,
    @Body() dto: SetDesignSelectionDto,
  ) {
    return this.designs.setSelection(cafeId, {
      menuDesignKey: dto.menuDesignKey,
      welcomeDesignKey: dto.welcomeDesignKey,
    });
  }
}
