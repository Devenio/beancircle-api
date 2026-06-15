import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'change-me',
    });
  }

  async validate(payload: { sub: string }) {
    const user = await this.authService.validateUser(payload.sub);
    if (!user) throw new UnauthorizedException();
    if (user.status === 'BANNED') {
      throw new UnauthorizedException('Account banned');
    }
    if (
      user.status === 'SUSPENDED' &&
      user.suspendedUntil &&
      user.suspendedUntil > new Date()
    ) {
      throw new UnauthorizedException('Account suspended');
    }
    return user;
  }
}
