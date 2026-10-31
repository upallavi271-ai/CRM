import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth-user';
import { dealScope, leadScope } from '../common/scope';
import { LeadStatus, Prisma, StageType } from '@prisma/client';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('summary')
  async summary(@CurrentUser() user: AuthUser) {
    const tenantId = user.tenantId;
    const monthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    const can = (p: string) => user.permissions.includes(p);

    const [customers, sales, recentActivity] = await Promise.all([
      can('Customer.Read') ? this.customerStats(tenantId, monthStart) : null,
      can('Lead.Read') || can('Deal.Read')
        ? this.salesStats(user, monthStart)
        : null,
      can('AuditLog.Read')
        ? this.prisma.auditLog.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            take: 8,
            select: {
              id: true,
              module: true,
              action: true,
              recordId: true,
              userId: true,
              createdAt: true,
            },
          })
        : [],
    ]);

    return { customers, sales, recentActivity };
  }

  private async customerStats(tenantId: string, monthStart: Date) {
    const where = { tenantId, isDeleted: false };
    const [total, newThisMonth, active] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.count({
        where: { ...where, createdAt: { gte: monthStart } },
      }),
      this.prisma.customer.count({ where: { ...where, status: 'ACTIVE' } }),
    ]);
    return { total, newThisMonth, active };
  }

  private async salesStats(user: AuthUser, monthStart: Date) {
    const canLeads = user.permissions.includes('Lead.Read');
    const canDeals = user.permissions.includes('Deal.Read');

    type StatusRow = { status: LeadStatus; _count: { _all: number } };
    type DealRow = {
      value: Prisma.Decimal;
      closedAt: Date | null;
      stage: { type: StageType; probability: number };
    };

    let leadsByStatus: StatusRow[] = [];
    let newLeadsThisMonth = 0;
    let deals: DealRow[] = [];
    if (canLeads) {
      const where = leadScope(user);
      const rows = await this.prisma.lead.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      });
      leadsByStatus = rows.map((r) => ({
        status: r.status,
        _count: { _all: r._count._all },
      }));
      newLeadsThisMonth = await this.prisma.lead.count({
        where: { ...where, createdAt: { gte: monthStart } },
      });
    }
    if (canDeals) {
      deals = await this.prisma.deal.findMany({
        where: dealScope(user),
        select: {
          value: true,
          closedAt: true,
          stage: { select: { type: true, probability: true } },
        },
      });
    }

    const leadCount = (s: string) =>
      leadsByStatus.find((r) => r.status === s)?._count._all ?? 0;
    const totalLeads = leadsByStatus.reduce((sum, r) => sum + r._count._all, 0);
    const converted = leadCount('CONVERTED');

    const open = deals.filter((d) => d.stage.type === 'OPEN');
    const won = deals.filter((d) => d.stage.type === 'WON');
    const wonThisMonth = won.filter(
      (d) => d.closedAt && d.closedAt >= monthStart,
    );
    const sum = (list: typeof deals) =>
      list.reduce((s, d) => s + Number(d.value), 0);

    return {
      leads: canLeads
        ? {
            total: totalLeads,
            newThisMonth: newLeadsThisMonth,
            byStatus: Object.fromEntries(
              leadsByStatus.map((r) => [r.status, r._count._all]),
            ),
            conversionRate: totalLeads
              ? Math.round((converted / totalLeads) * 1000) / 10
              : 0,
          }
        : null,
      deals: canDeals
        ? {
            openCount: open.length,
            openValue: sum(open),
            weightedValue: Math.round(
              open.reduce(
                (s, d) => s + (Number(d.value) * d.stage.probability) / 100,
                0,
              ),
            ),
            wonThisMonthCount: wonThisMonth.length,
            wonThisMonthValue: sum(wonThisMonth),
          }
        : null,
      // Leads > Qualified > Deals > Won
      funnel: [
        { label: 'Leads', value: totalLeads },
        { label: 'Qualified', value: leadCount('QUALIFIED') + converted },
        { label: 'Deals', value: deals.length },
        { label: 'Won', value: won.length },
      ],
    };
  }
}
