import { Module } from '@nestjs/common';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [CustomFieldsModule],
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
