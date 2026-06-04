import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  getSettings(@CurrentUser() user: { id: string }) {
    return this.settingsService.getSettings(user.id);
  }

  @Patch()
  updateSettings(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.settingsService.updateSettings(user.id, dto);
  }

  @Get('blocked')
  listBlocked(@CurrentUser() user: { id: string }) {
    return this.settingsService.listBlockedUsers(user.id);
  }

  @Get('muted')
  listMuted(@CurrentUser() user: { id: string }) {
    return this.settingsService.listMutedUsers(user.id);
  }

  @Get('sessions')
  listSessions(
    @CurrentUser() user: { id: string },
    @Query('currentSessionId') currentSessionId?: string,
  ) {
    return this.settingsService.listSessions(user.id, currentSessionId);
  }

  @Delete('sessions/:id')
  revokeSession(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.settingsService.revokeSession(user.id, id);
  }
}
