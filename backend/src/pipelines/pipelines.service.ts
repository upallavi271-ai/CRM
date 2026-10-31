import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/auth-user';

@Injectable()
export class PipelinesService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser) {
    return this.prisma.pipeline.findMany({
      where: { tenantId: user.tenantId },
      include: { stages: { orderBy: { position: 'asc' } } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async getDefault(user: AuthUser) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { tenantId: user.tenantId },
      include: { stages: { orderBy: { position: 'asc' } } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    if (!pipeline) throw new NotFoundException('No sales pipeline configured');
    return pipeline;
  }

  /** Resolves pipeline + stage, checking they belong to this tenant and to each other. */
  async resolveStage(user: AuthUser, pipelineId?: string, stageId?: string) {
    const pipeline = pipelineId
      ? await this.prisma.pipeline.findFirst({
          where: { id: pipelineId, tenantId: user.tenantId },
          include: { stages: { orderBy: { position: 'asc' } } },
        })
      : await this.getDefault(user);
    if (!pipeline) throw new BadRequestException('Unknown pipeline');

    const stage = stageId
      ? pipeline.stages.find((s) => s.id === stageId)
      : pipeline.stages.find((s) => s.type === 'OPEN');
    if (!stage)
      throw new BadRequestException('Stage does not belong to this pipeline');
    return { pipeline, stage };
  }
}
