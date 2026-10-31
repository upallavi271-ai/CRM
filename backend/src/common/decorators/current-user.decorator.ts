import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthRequest, AuthUser } from '../auth-user';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<AuthRequest>().user as AuthUser,
);
