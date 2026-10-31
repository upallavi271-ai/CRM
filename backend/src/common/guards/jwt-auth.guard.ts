import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthRequest, AuthUser, JwtPayload } from '../auth-user';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    const [type, token] = String(req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token)
      throw new UnauthorizedException('Missing token');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Load fresh from DB so role/permission changes and deactivation apply immediately.
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        tenantId: payload.tenantId,
        isDeleted: false,
        status: 'ACTIVE',
      },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });
    if (!user) throw new UnauthorizedException('User not active');

    const authUser: AuthUser = {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      role: user.role.name,
      permissions: user.role.permissions.map((rp) => rp.permission.key),
    };
    req.user = authUser;
    return true;
  }
}
