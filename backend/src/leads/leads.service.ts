import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeadStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthUser } from '../common/auth-user';
import { leadScope, userSummary } from '../common/scope';
import { PipelinesService } from '../pipelines/pipelines.service';
import { ConvertLeadDto, CreateLeadDto, UpdateLeadDto } from './dto/lead.dto';

export interface LeadQuery {
  search?: string;
  status?: string;
  source?: string;
  /** 'me' | 'unassigned' | user id */
  assignedTo?: string;
  page?: string;
  pageSize?: string;
}

const leadInclude = {
  assignedTo: userSummary,
  convertedCustomer: { select: { id: true, name: true } },
  deals: {
    select: { id: true, number: true, title: true },
    where: { isDeleted: false },
  },
} satisfies Prisma.LeadInclude;

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pipelines: PipelinesService,
  ) {}

  async list(user: AuthUser, query: LeadQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const and: Prisma.LeadWhereInput[] = [leadScope(user)];

    const search = query.search?.trim();
    if (search) {
      and.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { company: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (query.status && query.status in LeadStatus) {
      and.push({ status: query.status as LeadStatus });
    }
    if (query.source) and.push({ source: query.source });
    if (query.assignedTo === 'me') and.push({ assignedToId: user.id });
    else if (query.assignedTo === 'unassigned')
      and.push({ assignedToId: null });
    else if (query.assignedTo) and.push({ assignedToId: query.assignedTo });

    const where = { AND: and };
    const [items, total, byStatus] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        include: { assignedTo: userSummary },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.lead.count({ where }),
      this.prisma.lead.groupBy({
        by: ['status'],
        where: leadScope(user),
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
    ]);
    const statusCounts = Object.fromEntries(
      byStatus.map((s) => [s.status, (s._count as { _all: number })._all]),
    );
    return { items, total, page, pageSize, statusCounts };
  }

  async get(user: AuthUser, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { ...leadScope(user), id },
      include: leadInclude,
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async create(user: AuthUser, dto: CreateLeadDto) {
    const canAssign = user.permissions.includes('Lead.Assign');
    let assignedToId: string | null = canAssign
      ? (dto.assignedToId ?? null)
      : user.id;
    if (canAssign && dto.assignedToId)
      assignedToId = await this.checkAssignee(user, dto.assignedToId);
    this.checkDisqualify(dto.status, dto.disqualifyReason);

    const lead = await this.prisma.lead.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name.trim(),
        email: dto.email?.trim().toLowerCase() || null,
        phone: dto.phone?.trim() || null,
        company: dto.company?.trim() || null,
        source: dto.source,
        status: dto.status,
        score: dto.score,
        requirement: dto.requirement?.trim() || null,
        estimatedValue: dto.estimatedValue ?? null,
        disqualifyReason:
          dto.status === 'DISQUALIFIED' ? dto.disqualifyReason : null,
        assignedToId,
        createdBy: user.id,
        updatedBy: user.id,
      },
      include: leadInclude,
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      module: 'Lead',
      recordId: lead.id,
      action: 'CREATE',
      newValue: lead,
    });
    return lead;
  }

  async update(user: AuthUser, id: string, dto: UpdateLeadDto) {
    const before = await this.get(user, id);
    if (before.status === 'CONVERTED' && dto.status) {
      throw new BadRequestException('A converted lead cannot change status');
    }

    let assignedToId: string | null | undefined;
    if (
      dto.assignedToId !== undefined &&
      dto.assignedToId !== before.assignedToId
    ) {
      if (!user.permissions.includes('Lead.Assign')) {
        throw new ForbiddenException('Missing permission: Lead.Assign');
      }
      assignedToId = dto.assignedToId
        ? await this.checkAssignee(user, dto.assignedToId)
        : null;
    }

    const status = dto.status ?? before.status;
    const disqualifyReason =
      dto.disqualifyReason ?? before.disqualifyReason ?? undefined;
    this.checkDisqualify(status, disqualifyReason);

    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        email:
          dto.email === undefined
            ? undefined
            : dto.email.trim().toLowerCase() || null,
        phone: dto.phone === undefined ? undefined : dto.phone.trim() || null,
        company:
          dto.company === undefined ? undefined : dto.company.trim() || null,
        source: dto.source,
        status: dto.status,
        score: dto.score,
        requirement:
          dto.requirement === undefined
            ? undefined
            : dto.requirement.trim() || null,
        estimatedValue: dto.estimatedValue,
        disqualifyReason: status === 'DISQUALIFIED' ? disqualifyReason : null,
        assignedToId,
        updatedBy: user.id,
      },
      include: leadInclude,
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      module: 'Lead',
      recordId: id,
      action: 'UPDATE',
      oldValue: before,
      newValue: lead,
    });
    return lead;
  }

  async remove(user: AuthUser, id: string) {
    const before = await this.get(user, id);
    await this.prisma.lead.update({
      where: { id },
      data: { isDeleted: true, updatedBy: user.id },
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      module: 'Lead',
      recordId: id,
      action: 'DELETE',
      oldValue: before,
    });
    return { id };
  }

  /**
   * Lead -> Customer (+ optional Deal). Reuses an existing customer with the same
   * email or phone instead of creating a duplicate.
   */
  async convert(user: AuthUser, id: string, dto: ConvertLeadDto) {
    const lead = await this.get(user, id);
    if (lead.status === 'CONVERTED')
      throw new BadRequestException('Lead is already converted');
    if (lead.status === 'DISQUALIFIED') {
      throw new BadRequestException(
        'Re-open a disqualified lead before converting it',
      );
    }
    const target = dto.createDeal
      ? await this.pipelines.resolveStage(user, undefined, dto.stageId)
      : null;
    if (target && target.stage.type !== 'OPEN') {
      throw new BadRequestException('A new deal must start in an open stage');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const match = [
        ...(lead.email ? [{ email: lead.email }] : []),
        ...(lead.phone ? [{ phone: lead.phone }] : []),
      ];
      let customer = match.length
        ? await tx.customer.findFirst({
            where: { tenantId: user.tenantId, isDeleted: false, OR: match },
          })
        : null;
      const reusedCustomer = !!customer;
      if (!customer) {
        customer = await tx.customer.create({
          data: {
            tenantId: user.tenantId,
            name: lead.company ? `${lead.name} (${lead.company})` : lead.name,
            email: lead.email,
            phone: lead.phone,
            tags: [lead.source],
            ownerId: lead.assignedToId ?? user.id,
            createdBy: user.id,
            updatedBy: user.id,
          },
        });
      }

      const deal = target
        ? await tx.deal.create({
            data: {
              tenantId: user.tenantId,
              title: dto.dealTitle!.trim(),
              value: dto.dealValue ?? 0,
              pipelineId: target.pipeline.id,
              stageId: target.stage.id,
              customerId: customer.id,
              leadId: lead.id,
              ownerId: lead.assignedToId ?? user.id,
              expectedCloseDate: dto.expectedCloseDate
                ? new Date(dto.expectedCloseDate)
                : null,
              notes: lead.requirement,
              createdBy: user.id,
              updatedBy: user.id,
            },
          })
        : null;

      const updated = await tx.lead.update({
        where: { id: lead.id },
        data: {
          status: 'CONVERTED',
          convertedCustomerId: customer.id,
          convertedDealId: deal?.id ?? null,
          convertedAt: new Date(),
          updatedBy: user.id,
        },
        include: leadInclude,
      });
      return { lead: updated, customer, deal, reusedCustomer };
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      module: 'Lead',
      recordId: lead.id,
      action: 'CONVERT',
      newValue: {
        customerId: result.customer.id,
        dealId: result.deal?.id ?? null,
      },
    });
    if (!result.reusedCustomer) {
      await this.audit.log({
        tenantId: user.tenantId,
        userId: user.id,
        module: 'Customer',
        recordId: result.customer.id,
        action: 'CREATE',
        newValue: result.customer,
      });
    }
    if (result.deal) {
      await this.audit.log({
        tenantId: user.tenantId,
        userId: user.id,
        module: 'Deal',
        recordId: result.deal.id,
        action: 'CREATE',
        newValue: result.deal,
      });
    }
    return result;
  }

  private async checkAssignee(user: AuthUser, assigneeId: string) {
    const assignee = await this.prisma.user.findFirst({
      where: {
        id: assigneeId,
        tenantId: user.tenantId,
        isDeleted: false,
        status: 'ACTIVE',
      },
    });
    if (!assignee) throw new BadRequestException('Assignee not found');
    return assignee.id;
  }

  private checkDisqualify(status?: LeadStatus, reason?: string) {
    if (status === 'DISQUALIFIED' && !reason?.trim()) {
      throw new BadRequestException('Give a reason when disqualifying a lead');
    }
  }
}
