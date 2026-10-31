import { Prisma } from '@prisma/client';
import { AuthUser } from './auth-user';

// Record-level access: users without *.ReadAll only see records they own or created.

export function leadScope(user: AuthUser): Prisma.LeadWhereInput {
  const base: Prisma.LeadWhereInput = {
    tenantId: user.tenantId,
    isDeleted: false,
  };
  if (user.permissions.includes('Lead.ReadAll')) return base;
  return { ...base, OR: [{ assignedToId: user.id }, { createdBy: user.id }] };
}

export function dealScope(user: AuthUser): Prisma.DealWhereInput {
  const base: Prisma.DealWhereInput = {
    tenantId: user.tenantId,
    isDeleted: false,
  };
  if (user.permissions.includes('Deal.ReadAll')) return base;
  return { ...base, OR: [{ ownerId: user.id }, { createdBy: user.id }] };
}

export const userSummary = { select: { id: true, name: true } } as const;
