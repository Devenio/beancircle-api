import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ScanService } from './scan.service';

class ResolveScanDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  payload: string;
}

@Controller('scan')
export class ScanController {
  constructor(private scan: ScanService) {}

  @Get('me/connect')
  myConnectQr(@CurrentUser() user: { id: string }) {
    return this.scan.getMyConnectQr(user.id);
  }

  @Post('resolve')
  resolve(@CurrentUser() user: { id: string }, @Body() dto: ResolveScanDto) {
    return this.scan.resolve(user.id, dto.payload);
  }
}
