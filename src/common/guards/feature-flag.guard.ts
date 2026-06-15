import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { REQUIRE_FEATURE_KEY } from '../decorators/feature-flag.decorator';

interface FlagRequest {
  params?: Record<string, string>;
}

/**
 * Enforces @RequireFeature('key'). Resolves the effective flag value using the
 * cafe in the route (`:cafeId`/`:id`) when present, else the global default.
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private flags: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const key = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!key) return true;

    const req = context.switchToHttp().getRequest<FlagRequest>();
    const cafeId = req.params?.cafeId ?? req.params?.id;
    const enabled = await this.flags.isEnabled(key, cafeId);
    if (!enabled) {
      throw new ForbiddenException(`Feature "${key}" is currently unavailable`);
    }
    return true;
  }
}
