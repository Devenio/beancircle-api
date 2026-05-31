import { Body, Controller, Post } from '@nestjs/common';
import { IsIn, IsString } from 'class-validator';
import { UploadsService } from './uploads.service';

class PresignDto {
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType: string;

  @IsString()
  @IsIn(['avatars', 'posts', 'reviews', 'messages'])
  folder: string;
}

@Controller('uploads')
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  @Post('presign')
  presign(@Body() dto: PresignDto) {
    return this.uploadsService.presign(dto.contentType, dto.folder);
  }
}
