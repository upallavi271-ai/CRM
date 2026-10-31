import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthUser } from '../common/auth-user';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import {
  CustomValues,
  validateCustomFieldValues,
} from '../custom-fields/validate-custom-fields';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

export interface CustomerQuery {
  search?: string;
  status?: string;
  tag?: string;
  page?: string;
  pageSize?: string;
  /** Custom field filters arrive as cf_<key>=value */
  [cfKey: `cf_${string}`]: string | undefined;
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly fields: CustomFieldsService,
  ) {}

  async list(user: AuthUser, query: CustomerQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const where = await this.buildWhere(user, query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async tags(user: AuthUser) {
    const rows = await this.prisma.$queryRaw<{ tag: string }[]>`
      SELECT DISTINCT unnest(tags) AS tag FROM customers
      WHERE tenant_id = ${user.tenantId}::uuid AND is_deleted = false
      ORDER BY tag`;
    return rows.map((r) => r.tag);
  }

  async get(user: AuthUser, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId: user.tenantId, isDeleted: false },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async create(user: AuthUser, dto: CreateCustomerDto) {
    const customFields = await this.checkCustomFields(
      user,
      dto.customFields ?? {},
      false,
    );
    const customer = await this.prisma.customer.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name.trim(),
        email: dto.email?.trim().toLowerCase() || null,
        phone: dto.phone?.trim() || null,
        status: dto.status,
        tags: cleanTags(dto.tags),
        customFields,
        ownerId: user.id,
        createdBy: user.id,
        updatedBy: user.id,
      },
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      module: 'Customer',
      recordId: customer.id,
      action: 'CREATE',
      newValue: customer,
    });
    return customer;
  }

  async update(user: AuthUser, id: string, dto: UpdateCustomerDto) {
    const before = await this.get(user, id);
    let customFields: CustomValues | undefined;
    if (dto.customFields) {
      const changed = await this.checkCustomFields(
        user,
        dto.customFields,
        true,
      );
      customFields = { ...(before.customFields as CustomValues), ...changed };
    }

    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        email:
          dto.email === undefined
            ? undefined
            : dto.email.trim().toLowerCase() || null,
        phone: dto.phone === undefined ? undefined : dto.phone.trim() || null,
        status: dto.status,
        tags: dto.tags ? cleanTags(dto.tags) : undefined,
        customFields,
        updatedBy: user.id,
      },
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      module: 'Customer',
      recordId: id,
      action: 'UPDATE',
      oldValue: before,
      newValue: customer,
    });
    return customer;
  }

  async remove(user: AuthUser, id: string) {
    const before = await this.get(user, id);
    await this.prisma.customer.update({
      where: { id },
      data: { isDeleted: true, updatedBy: user.id },
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      module: 'Customer',
      recordId: id,
      action: 'DELETE',
      oldValue: before,
    });
    return { id };
  }

  /** CSV with base columns + one column per CRM field. */
  async exportCsv(user: AuthUser, query: CustomerQuery) {
    const defs = await this.fields.list(user);
    const where = await this.buildWhere(user, query);
    const customers = await this.prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const header = [
      'Name',
      'Email',
      'Phone',
      'Status',
      'Tags',
      ...defs.map((d) => d.name),
      'Created At',
    ];
    const rows = customers.map((c) => {
      const cf = c.customFields as CustomValues;
      return [
        c.name,
        c.email ?? '',
        c.phone ?? '',
        c.status,
        c.tags.join('; '),
        ...defs.map((d) => cf[d.key] ?? ''),
        c.createdAt.toISOString(),
      ];
    });
    return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  }

  private async checkCustomFields(
    user: AuthUser,
    input: Record<string, unknown>,
    partial: boolean,
  ) {
    const defs = await this.fields.list(user);
    const { values, errors } = validateCustomFieldValues(defs, input, partial);
    if (errors.length) throw new BadRequestException(errors);
    return values;
  }

  private async buildWhere(
    user: AuthUser,
    query: CustomerQuery,
  ): Promise<Prisma.CustomerWhereInput> {
    const and: Prisma.CustomerWhereInput[] = [
      { tenantId: user.tenantId, isDeleted: false },
    ];

    const search = query.search?.trim();
    if (search) {
      and.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      });
    }
    if (query.status && query.status in CustomerStatus) {
      and.push({ status: query.status as CustomerStatus });
    }
    if (query.tag) and.push({ tags: { has: query.tag } });

    const cfFilters = Object.entries(query).filter(
      ([k, v]) => k.startsWith('cf_') && v,
    );
    if (cfFilters.length) {
      const defs = await this.fields.list(user);
      for (const [k, v] of cfFilters) {
        const def = defs.find((d) => d.key === k.slice(3));
        if (!def || typeof v !== 'string') continue;
        if (def.type === 'NUMBER' && Number.isFinite(Number(v))) {
          and.push({ customFields: { path: [def.key], equals: Number(v) } });
        } else if (def.type === 'BOOLEAN') {
          and.push({ customFields: { path: [def.key], equals: v === 'true' } });
        } else if (def.type === 'SELECT' || def.type === 'DATE') {
          and.push({ customFields: { path: [def.key], equals: v } });
        } else {
          // Text-like fields: case-insensitive "contains" (Prisma JSON filters are case-sensitive).
          const pattern = `%${v.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
          const rows = await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM customers
            WHERE tenant_id = ${user.tenantId}::uuid AND is_deleted = false
              AND custom_fields->>${def.key} ILIKE ${pattern}`;
          and.push({ id: { in: rows.map((r) => r.id) } });
        }
      }
    }
    return { AND: and };
  }
}

function cleanTags(tags?: string[]) {
  return [...new Set((tags ?? []).map((t) => t.trim()).filter(Boolean))];
}

function csvCell(value: string | number | boolean | null | undefined) {
  const s = String(value ?? '');
  // Quote when needed; prefix formula-like values so spreadsheets don't execute them.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
