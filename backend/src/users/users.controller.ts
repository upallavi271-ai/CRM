import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth-user';

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /** Minimal list (id + name) for assignee / owner dropdowns. Any logged-in user. */
  @Get('lookup')
  lookup(@CurrentUser() user: AuthUser) {
    return this.prisma.user.findMany({
      where: { tenantId: user.tenantId, isDeleted: false, status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  @Get()
  @RequirePermissions('User.Read')
  list(@CurrentUser() user: AuthUser) {
    return this.prisma.user.findMany({
      where: { tenantId: user.tenantId, isDeleted: false },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        lastLoginAt: true,
        role: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }
}
