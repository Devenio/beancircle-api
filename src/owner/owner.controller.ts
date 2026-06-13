import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OwnerService } from './owner.service';

class ClaimCafeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[A-Z0-9-]+$/, {
    message:
      'claimCode must contain only uppercase letters, digits, and hyphens',
  })
  claimCode: string;
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

  @Post('cafes/claim')
  claim(@CurrentUser() user: { id: string }, @Body() dto: ClaimCafeDto) {
    return this.owner.claimCafe(user.id, dto.claimCode);
  }

  @Get('cafes/:id/analytics')
  analytics(
    @CurrentUser() user: { id: string },
    @Param('id') cafeId: string,
  ) {
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
