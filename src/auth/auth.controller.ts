import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { GoogleExchangeDto } from './dto/google-exchange.dto';
import { OtpRequestDto } from './dto/otp-request.dto';
import { OtpVerifyDto } from './dto/otp-verify.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @Post('otp/request')
  requestOtp(@Body() dto: OtpRequestDto) {
    return this.authService.requestOtp(dto.phone);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  @Post('otp/verify')
  verifyOtp(@Body() dto: OtpVerifyDto, @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string }) {
    return this.authService.verifyOtp(dto.phone, dto.code, req);
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {}

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const tokens = await this.authService.validateGoogleUser(
      req.user as {
        googleId: string;
        email?: string;
        name?: string;
        avatarUrl?: string;
      },
      { headers: req.headers, ip: req.ip },
    );
    const front = this.config.get('FRONTEND_URL') ?? 'http://localhost:3000';
    const code = await this.authService.createGoogleAuthCode(tokens);
    res.redirect(`${front}/auth/callback?code=${encodeURIComponent(code)}`);
  }

  @Public()
  @Post('google/exchange')
  exchangeGoogle(@Body() dto: GoogleExchangeDto) {
    return this.authService.exchangeGoogleCode(dto.code);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('refresh')
  refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
  ) {
    return this.authService.refresh(dto.refreshToken, req);
  }

  @Post('logout')
  logout(
    @CurrentUser() user: { id: string },
    @Body() body?: { refreshToken?: string },
  ) {
    return this.authService.logout(user.id, body?.refreshToken);
  }
}
