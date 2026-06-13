import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CafeRole, CafeStaff } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CAFE_ROLES_KEY } from '../decorators/cafe-roles.decorator';

export interface CafeStaffRequest {
  user?: { id: string };
  params: Record<string, string>;
  cafeStaff?: CafeStaff;
}

/**
 * Verifies the authenticated user is a staff member of the cafe referenced
 * by the `:cafeId` (or `:id`) route param, optionally restricted by @CafeRoles.
 * Attaches the staff row to the request as `cafeStaff`.
 */
@Injectable()
export class CafeStaffGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<CafeStaffRequest>();
    const user = req.user;
    if (!user?.id) throw new ForbiddenException('Not authenticated');

    const cafeId = req.params.cafeId ?? req.params.id;
    if (!cafeId) throw new ForbiddenException('Missing cafe id');

    const staff = await this.prisma.cafeStaff.findUnique({
      where: { userId_cafeId: { userId: user.id, cafeId } },
    });
    if (!staff) {
      throw new ForbiddenException('You are not a member of this cafe');
    }

    const roles = this.reflector.getAllAndOverride<CafeRole[] | undefined>(
      CAFE_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (roles?.length && !roles.includes(staff.role)) {
      throw new ForbiddenException('Insufficient cafe role');
    }

    req.cafeStaff = staff;
    return true;
  }
}
