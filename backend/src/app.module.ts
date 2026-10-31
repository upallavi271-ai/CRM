import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './common/audit/audit.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PipelinesModule } from './pipelines/pipelines.module';
import { LeadsModule } from './leads/leads.module';
import { DealsModule } from './deals/deals.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '8h') },
      }),
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    CustomFieldsModule,
    CustomersModule,
    DashboardModule,
    PipelinesModule,
    LeadsModule,
    DealsModule,
  ],
  providers: [
    // Order matters: authenticate first, then check permissions.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
