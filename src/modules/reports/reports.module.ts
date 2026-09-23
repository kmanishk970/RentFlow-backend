import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [BillingModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
