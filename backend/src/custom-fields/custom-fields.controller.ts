import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth-user';
import { CustomFieldsService } from './custom-fields.service';
import {
  CreateCustomFieldDto,
  ReorderCustomFieldsDto,
  UpdateCustomFieldDto,
} from './dto/custom-field.dto';

@Controller('custom-fields')
export class CustomFieldsController {
  constructor(private readonly fields: CustomFieldsService) {}

  @Get()
  @RequirePermissions('CustomField.Read')
  list(@CurrentUser() user: AuthUser) {
    return this.fields.list(user);
  }

  @Post()
  @RequirePermissions('CustomField.Create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomFieldDto) {
    return this.fields.create(user, dto);
  }

  @Post('reorder')
  @HttpCode(200)
  @RequirePermissions('CustomField.Update')
  reorder(@CurrentUser() user: AuthUser, @Body() dto: ReorderCustomFieldsDto) {
    return this.fields.reorder(user, dto.ids);
  }

  @Patch(':id')
  @RequirePermissions('CustomField.Update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomFieldDto,
  ) {
    return this.fields.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('CustomField.Delete')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.fields.remove(user, id);
  }
}
