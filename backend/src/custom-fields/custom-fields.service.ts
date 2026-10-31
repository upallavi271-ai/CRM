import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthUser } from '../common/auth-user';
import {
  CreateCustomFieldDto,
  UpdateCustomFieldDto,
} from './dto/custom-field.dto';
import { toFieldKey } from './validate-custom-fields';

@Injectable()
export class CustomFieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(user: AuthUser, entity = 'customer') {
    return this.prisma.customField.findMany({
      where: { tenantId: user.tenantId, entity, isDeleted: false },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(user: AuthUser, dto: CreateCustomFieldDto) {
    const entity = dto.entity ?? 'customer';
    const key = dto.key ?? toFieldKey(dto.name);
    const options = cleanOptions(dto.options);
    if (dto.type === 'SELECT' && options.length === 0) {
      throw new BadRequestException(
        'A dropdown field needs at least one option',
      );
    }

    const existing = await this.prisma.customField.findFirst({
      where: { tenantId: user.tenantId, entity, key, isDeleted: false },
    });
    if (existing)
      throw new ConflictException(`A field with key "${key}" already exists`);

    const last = await this.prisma.customField.findFirst({
      where: { tenantId: user.tenantId, entity, isDeleted: false },
      orderBy: { position: 'desc' },
    });

    const field = await this.prisma.customField.create({
      data: {
        tenantId: user.tenantId,
        entity,
        name: dto.name.trim(),
        key,
        type: dto.type,
        options: dto.type === 'SELECT' ? options : [],
        required: dto.required ?? false,
        color: dto.color ?? '#3b82f6',
        position: (last?.position ?? -1) + 1,
        createdBy: user.id,
        updatedBy: user.id,
      },
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      module: 'CustomField',
      recordId: field.id,
      action: 'CREATE',
      newValue: field,
    });
    return field;
  }

  async update(user: AuthUser, id: string, dto: UpdateCustomFieldDto) {
    const before = await this.findOrThrow(user, id);
    const type = dto.type ?? before.type;
    const options =
      dto.options !== undefined ? cleanOptions(dto.options) : before.options;
    if (type === 'SELECT' && options.length === 0) {
      throw new BadRequestException(
        'A dropdown field needs at least one option',
      );
    }

    const field = await this.prisma.customField.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        type,
        options: type === 'SELECT' ? options : [],
        required: dto.required,
        color: dto.color,
        updatedBy: user.id,
      },
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      module: 'CustomField',
      recordId: id,
      action: 'UPDATE',
      oldValue: before,
      newValue: field,
    });
    return field;
  }

  async remove(user: AuthUser, id: string) {
    const before = await this.findOrThrow(user, id);
    // Soft delete: stored values on customers stay, the field just stops showing.
    await this.prisma.customField.update({
      where: { id },
      data: { isDeleted: true, updatedBy: user.id },
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      module: 'CustomField',
      recordId: id,
      action: 'DELETE',
      oldValue: before,
    });
    return { id };
  }

  async reorder(user: AuthUser, ids: string[]) {
    const fields = await this.prisma.customField.findMany({
      where: { tenantId: user.tenantId, id: { in: ids }, isDeleted: false },
      select: { id: true },
    });
    if (fields.length !== ids.length)
      throw new BadRequestException('Unknown field in order list');

    await this.prisma.$transaction(
      ids.map((id, position) =>
        this.prisma.customField.update({ where: { id }, data: { position } }),
      ),
    );
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      module: 'CustomField',
      action: 'REORDER',
      newValue: ids,
    });
    return this.list(user);
  }

  private async findOrThrow(user: AuthUser, id: string) {
    const field = await this.prisma.customField.findFirst({
      where: { id, tenantId: user.tenantId, isDeleted: false },
    });
    if (!field) throw new NotFoundException('Field not found');
    return field;
  }
}

function cleanOptions(options?: string[]) {
  return [...new Set((options ?? []).map((o) => o.trim()).filter(Boolean))];
}
