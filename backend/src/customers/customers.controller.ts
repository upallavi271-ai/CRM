import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth-user';
import { CustomersService } from './customers.service';
import type { CustomerQuery } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions('Customer.Read')
  list(@CurrentUser() user: AuthUser, @Query() query: CustomerQuery) {
    return this.customers.list(user, query);
  }

  @Get('tags')
  @RequirePermissions('Customer.Read')
  tags(@CurrentUser() user: AuthUser) {
    return this.customers.tags(user);
  }

  @Get('export')
  @RequirePermissions('Customer.Read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="customers.csv"')
  export(@CurrentUser() user: AuthUser, @Query() query: CustomerQuery) {
    return this.customers.exportCsv(user, query);
  }

  @Get(':id')
  @RequirePermissions('Customer.Read')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.get(user, id);
  }

  @Post()
  @RequirePermissions('Customer.Create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerDto) {
    return this.customers.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions('Customer.Update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('Customer.Delete')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customers.remove(user, id);
  }
}
