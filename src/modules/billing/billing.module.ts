import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { Bill } from './entities/bill.model';
import { BillLine } from './entities/bill-line.model';
import { Payment } from './entities/payment.model';
import { MeterReading } from './entities/meter-reading.model';
import { Lease } from '../leases/entities/lease.model';
import { Unit } from '../properties/entities/unit.model';

import {
  BillsController, LedgerController, MeterReadingsController, PaymentsController,
} from './billing.controller';
import { BillingService } from './billing.service';
import { LedgerService } from './ledger.service';

@Module({
  imports: [
    SequelizeModule.forFeature([Bill, BillLine, Payment, MeterReading, Lease, Unit]),
  ],
  controllers: [
    BillsController, PaymentsController, LedgerController, MeterReadingsController,
  ],
  providers: [BillingService, LedgerService],
  exports: [BillingService, LedgerService],
})
export class BillingModule {}
