import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { EventRsvpStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EventsService } from './events.service';

class RsvpDto {
  @IsEnum(EventRsvpStatus)
  status: EventRsvpStatus;
}

@Controller('events')
export class EventsController {
  constructor(private events: EventsService) {}

  @Get()
  list(
    @Query('cityId') cityId?: string,
    @CurrentUser() user?: { id: string },
  ) {
    return this.events.listUpcoming(cityId);
  }

  @Get(':id')
  one(@Param('id') id: string, @CurrentUser() user?: { id: string }) {
    return this.events.get(id, user?.id);
  }

  @Post(':id/rsvp')
  rsvp(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: RsvpDto,
  ) {
    return this.events.rsvp(user.id, id, dto.status);
  }
}
