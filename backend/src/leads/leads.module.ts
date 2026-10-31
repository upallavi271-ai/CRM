import { Module } from '@nestjs/common';
import { PipelinesModule } from '../pipelines/pipelines.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [PipelinesModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
