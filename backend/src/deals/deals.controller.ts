import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth-user';
import { DealsService } from './deals.service';
import type { DealQuery } from './deals.service';
import { CreateDealDto, MoveDealDto, UpdateDealDto } from './dto/deal.dto';

@Controller('deals')
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Get('board')
  @RequirePermissions('Deal.Read')
  board(@CurrentUser() user: AuthUser, @Query() query: DealQuery) {
    return this.deals.board(user, query);
  }

  @Get(':id')
  @RequirePermissions('Deal.Read')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.deals.get(user, id);
  }

  @Post()
  @RequirePermissions('Deal.Create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDealDto) {
    return this.deals.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions('Deal.Update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDealDto,
  ) {
    return this.deals.update(user, id, dto);
  }

  @Patch(':id/stage')
  @RequirePermissions('Deal.Update')
  move(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveDealDto,
  ) {
    return this.deals.move(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('Deal.Delete')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deals.remove(user, id);
  }
}
