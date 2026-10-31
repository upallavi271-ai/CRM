import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  tenantId: string;
  userId?: string;
  module: string;
  recordId?: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/** Records who changed what and when. Every create/update/delete should call log(). */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        userId: entry.userId,
        module: entry.module,
        recordId: entry.recordId,
        action: entry.action,
        oldValue: toJson(entry.oldValue),
        newValue: toJson(entry.newValue),
      },
    });
  }
}

function toJson(value: unknown) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
