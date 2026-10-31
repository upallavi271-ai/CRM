import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { AuthRequest } from '../auth-user';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required?.length) return true;

    const user = ctx.switchToHttp().getRequest<AuthRequest>().user;
    const missing = required.filter((p) => !user?.permissions.includes(p));
    if (missing.length)
      throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
    return true;
  }
}
