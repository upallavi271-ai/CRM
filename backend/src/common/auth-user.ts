// The logged-in user, attached to every authenticated request by JwtAuthGuard.
export interface AuthUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

export interface JwtPayload {
  sub: string;
  tenantId: string;
}

export type AuthRequest = import('express').Request & { user?: AuthUser };
