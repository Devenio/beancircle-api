import { SetMetadata } from '@nestjs/common';

export const REQUIRE_FEATURE_KEY = 'requireFeature';

/**
 * Gate a route behind a feature flag. When the flag is disabled (globally, or
 * per-cafe when the route has a `:cafeId`/`:id` param) the FeatureFlagGuard
 * returns 403. Apply alongside the route's normal guards.
 */
export const RequireFeature = (key: string) =>
  SetMetadata(REQUIRE_FEATURE_KEY, key);
