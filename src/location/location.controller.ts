import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationService } from './location.service';

@Controller('users')
export class LocationController {
  constructor(private locationService: LocationService) {}

  @Post('location')
  updateLocation(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateLocationDto,
  ) {
    return this.locationService.updateLocation(user.id, dto.lat, dto.lng);
  }

  @Get('me/location')
  getMyLocation(@CurrentUser() user: { id: string }) {
    return this.locationService.getMyLocation(user.id);
  }
}
