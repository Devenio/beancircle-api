import { SetMetadata } from '@nestjs/common';
import { CafeRole } from '@prisma/client';

export const CAFE_ROLES_KEY = 'cafeRoles';

/**
 * Restrict a CafeStaffGuard-protected route to specific cafe roles.
 * Without this decorator any staff member of the cafe may access the route.
 */
export const CafeRoles = (...roles: CafeRole[]) =>
  SetMetadata(CAFE_ROLES_KEY, roles);

export const CAFE_EDIT_ROLES: CafeRole[] = [CafeRole.OWNER, CafeRole.MANAGER];
export const CAFE_MARKETING_ROLES: CafeRole[] = [
  CafeRole.OWNER,
  CafeRole.MANAGER,
  CafeRole.MODERATOR,
];
