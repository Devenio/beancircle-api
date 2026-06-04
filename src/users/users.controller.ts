import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Public()
  @Get('cities')
  listCities() {
    return this.usersService.listCities();
  }

  @Get('me')
  getMe(@CurrentUser() user: { id: string }) {
    return this.usersService.getMe(user.id);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Get('me/favorite-cafes')
  favoriteCafes(@CurrentUser() user: { id: string }) {
    return this.usersService.getFavoriteCafes(user.id);
  }

  @Post('me/favorite-cafes/:cafeId')
  addFavorite(
    @CurrentUser() user: { id: string },
    @Param('cafeId') cafeId: string,
  ) {
    return this.usersService.addFavoriteCafe(user.id, cafeId);
  }

  @Delete('me/favorite-cafes/:cafeId')
  removeFavorite(
    @CurrentUser() user: { id: string },
    @Param('cafeId') cafeId: string,
  ) {
    return this.usersService.removeFavoriteCafe(user.id, cafeId);
  }

  @Get(':username')
  getProfile(
    @Param('username') username: string,
    @CurrentUser() user?: { id: string },
  ) {
    return this.usersService.getByUsername(username, user?.id);
  }

  @Post(':id/follow')
  follow(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.usersService.follow(user.id, id);
  }

  @Delete(':id/follow')
  unfollow(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.usersService.unfollow(user.id, id);
  }

  @Get(':id/presence')
  getPresence(
    @Param('id') id: string,
    @CurrentUser() user?: { id: string },
  ) {
    return this.usersService.getPresence(id, user?.id);
  }

  @Get(':id/block-status')
  getBlockStatus(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.usersService.getBlockStatus(user.id, id);
  }

  @Post(':id/block')
  blockUser(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.usersService.blockUser(user.id, id);
  }

  @Delete(':id/block')
  unblockUser(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.usersService.unblockUser(user.id, id);
  }
}
