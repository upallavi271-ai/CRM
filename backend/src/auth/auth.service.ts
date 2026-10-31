import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { JwtPayload } from '../common/auth-user';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto) {
    // Single-tenant login for now; with multiple tenants, add a workspace/subdomain to the login form.
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email.toLowerCase(),
        isDeleted: false,
        status: 'ACTIVE',
      },
    });
    const ok = user && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !ok)
      throw new UnauthorizedException('Invalid email or password');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      module: 'Auth',
      recordId: user.id,
      action: 'LOGIN',
    });

    const payload: JwtPayload = { sub: user.id, tenantId: user.tenantId };
    return { accessToken: await this.jwt.signAsync(payload) };
  }
}
