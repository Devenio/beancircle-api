import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OwnerService } from './owner.service';

class ClaimOwnershipDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}

class UpdateOwnerCafeDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
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
}

@Controller('owner')
export class OwnerController {
  constructor(private owner: OwnerService) {}

  @Get('cafes')
  cafes(@CurrentUser() user: { id: string }) {
    return this.owner.listCafes(user.id);
  }

  @Get('cafes/unclaimed')
  unclaimed(@Query('q') q?: string) {
    return this.owner.listUnclaimed(q);
  }

  @Post('cafes/:id/claim')
  claim(
    @CurrentUser() user: { id: string },
    @Param('id') cafeId: string,
    @Body() dto: ClaimOwnershipDto,
  ) {
    return this.owner.claimOwnership(user.id, cafeId, dto);
  }

  @Get('cafes/:id/analytics')
  analytics(@CurrentUser() user: { id: string }, @Param('id') cafeId: string) {
    return this.owner.analytics(user.id, cafeId);
  }

  @Patch('cafes/:id')
  update(
    @CurrentUser() user: { id: string },
    @Param('id') cafeId: string,
    @Body() dto: UpdateOwnerCafeDto,
  ) {
    return this.owner.updateCafe(user.id, cafeId, dto);
  }
}
