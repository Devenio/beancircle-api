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
    const secret = config.getOrThrow<string>('JWT_SECRET');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
      algorithms: ['HS256'],
      issuer: 'beancircle',
      audience: 'beancircle-api',
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
