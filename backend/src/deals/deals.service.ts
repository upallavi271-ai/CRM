import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PipelineStage, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthUser } from '../common/auth-user';
import { dealScope, userSummary } from '../common/scope';
import { PipelinesService } from '../pipelines/pipelines.service';
import { CreateDealDto, MoveDealDto, UpdateDealDto } from './dto/deal.dto';

export interface DealQuery {
  pipelineId?: string;
  search?: string;
  /** 'me' | user id */
  ownerId?: string;
  customerId?: string;
}

const dealInclude = {
  stage: true,
  customer: { select: { id: true, name: true } },
  owner: userSummary,
  lead: { select: { id: true, number: true, name: true } },
} satisfies Prisma.DealInclude;

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pipelines: PipelinesService,
  ) {}

  /** All deals of one pipeline, for the Kanban board. */
  async board(user: AuthUser, query: DealQuery) {
    const pipeline = query.pipelineId
      ? (await this.pipelines.list(user)).find((p) => p.id === query.pipelineId)
      : await this.pipelines.getDefault(user);
    if (!pipeline) throw new NotFoundException('Pipeline not found');

    const and: Prisma.DealWhereInput[] = [
      dealScope(user),
      { pipelineId: pipeline.id },
    ];
    const search = query.search?.trim();
    if (search) {
      and.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }
    if (query.ownerId === 'me') and.push({ ownerId: user.id });
    else if (query.ownerId) and.push({ ownerId: query.ownerId });
    if (query.customerId) and.push({ customerId: query.customerId });

    const deals = await this.prisma.deal.findMany({
      where: { AND: and },
      include: dealInclude,
      orderBy: { stageChangedAt: 'desc' },
      take: 1000,
    });
    return { pipeline, deals };
  }

  async get(user: AuthUser, id: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { ...dealScope(user), id },
      include: dealInclude,
    });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  async create(user: AuthUser, dto: CreateDealDto) {
    const { pipeline, stage } = await this.pipelines.resolveStage(
      user,
      dto.pipelineId,
      dto.stageId,
    );
    this.checkLostReason(stage, dto.lostReason);
    const customerId = dto.customerId
      ? await this.checkCustomer(user, dto.customerId)
      : null;
    const ownerId = await this.resolveOwner(user, dto.ownerId, undefined);

    const deal = await this.prisma.deal.create({
      data: {
        tenantId: user.tenantId,
        title: dto.title.trim(),
        value: dto.value,
        pipelineId: pipeline.id,
        stageId: stage.id,
        customerId,
        ownerId: ownerId ?? user.id,
        expectedCloseDate: dto.expectedCloseDate
          ? new Date(dto.expectedCloseDate)
          : null,
        notes: dto.notes?.trim() || null,
        closedAt: stage.type === 'OPEN' ? null : new Date(),
        lostReason: stage.type === 'LOST' ? dto.lostReason : null,
        createdBy: user.id,
        updatedBy: user.id,
      },
      include: dealInclude,
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      module: 'Deal',
      recordId: deal.id,
      action: 'CREATE',
      newValue: deal,
    });
    return deal;
  }

  async update(user: AuthUser, id: string, dto: UpdateDealDto) {
    const before = await this.get(user, id);
    const stageData = dto.stageId
      ? await this.stageChange(user, before, dto.stageId, dto.lostReason)
      : {};
    const customerId =
      dto.customerId === undefined
        ? undefined
        : dto.customerId
          ? await this.checkCustomer(user, dto.customerId)
          : null;
    const ownerId = await this.resolveOwner(user, dto.ownerId, before.ownerId);

    const deal = await this.prisma.deal.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        value: dto.value,
        customerId,
        ownerId,
        expectedCloseDate:
          dto.expectedCloseDate === undefined
            ? undefined
            : dto.expectedCloseDate
              ? new Date(dto.expectedCloseDate)
              : null,
        notes: dto.notes === undefined ? undefined : dto.notes.trim() || null,
        ...stageData,
        updatedBy: user.id,
      },
      include: dealInclude,
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      module: 'Deal',
      recordId: id,
      action: 'UPDATE',
      oldValue: before,
      newValue: deal,
    });
    return deal;
  }

  /** Drag & drop on the board. */
  async move(user: AuthUser, id: string, dto: MoveDealDto) {
    const before = await this.get(user, id);
    if (before.stageId === dto.stageId) return before;
    const stageData = await this.stageChange(
      user,
      before,
      dto.stageId,
      dto.lostReason,
    );
    const deal = await this.prisma.deal.update({
      where: { id },
      data: { ...stageData, updatedBy: user.id },
      include: dealInclude,
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      module: 'Deal',
      recordId: id,
      action:
        deal.stage.type === 'WON'
          ? 'WON'
          : deal.stage.type === 'LOST'
            ? 'LOST'
            : 'STAGE_CHANGE',
      oldValue: { stage: before.stage.name },
      newValue: { stage: deal.stage.name, lostReason: deal.lostReason },
    });
    return deal;
  }

  async remove(user: AuthUser, id: string) {
    const before = await this.get(user, id);
    await this.prisma.deal.update({
      where: { id },
      data: { isDeleted: true, updatedBy: user.id },
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      module: 'Deal',
      recordId: id,
      action: 'DELETE',
      oldValue: before,
    });
    return { id };
  }

  private async stageChange(
    user: AuthUser,
    deal: { pipelineId: string; stageId: string; lostReason: string | null },
    stageId: string,
    lostReason?: string,
  ) {
    const { stage } = await this.pipelines.resolveStage(
      user,
      deal.pipelineId,
      stageId,
    );
    this.checkLostReason(stage, lostReason ?? deal.lostReason ?? undefined);
    if (stage.id === deal.stageId) return {};
    return {
      stageId: stage.id,
      stageChangedAt: new Date(),
      closedAt: stage.type === 'OPEN' ? null : new Date(),
      lostReason:
        stage.type === 'LOST' ? (lostReason ?? deal.lostReason) : null,
    };
  }

  private checkLostReason(stage: PipelineStage, reason?: string) {
    if (stage.type === 'LOST' && !reason?.trim()) {
      throw new BadRequestException(
        'Give a reason when marking a deal as lost',
      );
    }
  }

  private async checkCustomer(user: AuthUser, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId: user.tenantId, isDeleted: false },
    });
    if (!customer) throw new BadRequestException('Customer not found');
    return customer.id;
  }

  /** Users without Deal.ReadAll can only own their own deals. */
  private async resolveOwner(
    user: AuthUser,
    requested: string | null | undefined,
    current: string | null | undefined,
  ) {
    if (requested === undefined || requested === current) return undefined;
    if (!user.permissions.includes('Deal.ReadAll') && requested !== user.id) {
      throw new ForbiddenException('You can only assign deals to yourself');
    }
    if (!requested) return null;
    const owner = await this.prisma.user.findFirst({
      where: {
        id: requested,
        tenantId: user.tenantId,
        isDeleted: false,
        status: 'ACTIVE',
      },
    });
    if (!owner) throw new BadRequestException('Owner not found');
    return owner.id;
  }
}
