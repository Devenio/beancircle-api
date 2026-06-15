import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EventRsvpStatus, EventType } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireFeature } from '../common/decorators/feature-flag.decorator';
import { FeatureFlagGuard } from '../common/guards/feature-flag.guard';
import { CreateEventDto, SetReminderDto } from './dto/event.dto';
import { EventsService } from './events.service';

class RsvpDto {
  @IsEnum(EventRsvpStatus)
  status: EventRsvpStatus;
}

@Controller('events')
@RequireFeature('events')
@UseGuards(FeatureFlagGuard)
export class EventsController {
  constructor(private events: EventsService) {}

  @Get()
  list(
    @Query('cityId') cityId?: string,
    @Query('type') type?: EventType,
    @Query('cafeId') cafeId?: string,
  ) {
    return this.events.listUpcoming({ cityId, type, cafeId });
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateEventDto) {
    return this.events.create(user.id, dto);
  }

  @Get(':id')
  one(@Param('id') id: string, @CurrentUser() user?: { id: string }) {
    return this.events.get(id, user?.id);
  }

  @Get(':id/participants')
  participants(@Param('id') id: string) {
    return this.events.participants(id);
  }

  @Post(':id/rsvp')
  rsvp(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: RsvpDto,
  ) {
    return this.events.rsvp(user.id, id, dto.status);
  }

  @Post(':id/reminder')
  setReminder(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: SetReminderDto,
  ) {
    return this.events.setReminder(user.id, id, dto.remindAt);
  }

  @Delete(':id/reminder')
  clearReminder(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.events.clearReminder(user.id, id);
  }
}
