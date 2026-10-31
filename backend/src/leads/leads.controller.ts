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
  Query,
} from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth-user';
import { LeadsService } from './leads.service';
import type { LeadQuery } from './leads.service';
import {
  ConvertLeadDto,
  CreateLeadDto,
  LEAD_SOURCES,
  UpdateLeadDto,
} from './dto/lead.dto';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @RequirePermissions('Lead.Read')
  list(@CurrentUser() user: AuthUser, @Query() query: LeadQuery) {
    return this.leads.list(user, query);
  }

  @Get('sources')
  @RequirePermissions('Lead.Read')
  sources() {
    return LEAD_SOURCES;
  }

  @Get(':id')
  @RequirePermissions('Lead.Read')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.leads.get(user, id);
  }

  @Post()
  @RequirePermissions('Lead.Create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLeadDto) {
    return this.leads.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions('Lead.Update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leads.update(user, id, dto);
  }

  @Post(':id/convert')
  @HttpCode(200)
  @RequirePermissions('Lead.Convert')
  convert(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertLeadDto,
  ) {
    return this.leads.convert(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('Lead.Delete')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leads.remove(user, id);
  }
}
