import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsString } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UploadsService } from './uploads.service';

class PresignDto {
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
  contentType: string;

  @IsString()
  @IsIn(['avatars', 'posts', 'reviews', 'messages'])
  folder: string;
}

@Controller('uploads')
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('presign')
  presign(
    @CurrentUser() user: { id: string },
    @Body() dto: PresignDto,
  ) {
    return this.uploadsService.presign(user.id, dto.contentType, dto.folder);
  }
}
