import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { BillingService } from './billing.service';
import { LedgerService } from './ledger.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CreateReadingDto } from './dto/create-reading.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('bills')
@ApiBearerAuth()
@Controller('bills')
export class BillsController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @ApiQuery({ name: 'leaseId', required: false })
  findAll(
    @CurrentUser('ownerId') ownerId: string,
    @Query('leaseId') leaseId?: string,
  ) {
    return this.billing.findBills(ownerId, leaseId);
  }

  @Post()
  @ApiOperation({
    summary: 'Bill a month',
    description:
      'Billing a month that already has a bill replaces its charges rather than adding a second one.',
  })
  create(@CurrentUser('ownerId') ownerId: string, @Body() dto: CreateBillDto) {
    return this.billing.createBill(ownerId, dto);
  }

  @Get(':id')
  findOne(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billing.findBill(ownerId, id);
  }

  @Delete(':id')
  remove(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billing.removeBill(ownerId, id);
  }
}

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @ApiQuery({ name: 'leaseId', required: false })
  findAll(
    @CurrentUser('ownerId') ownerId: string,
    @Query('leaseId') leaseId?: string,
  ) {
    return this.billing.findPayments(ownerId, leaseId);
  }

  @Post()
  @ApiOperation({
    summary: 'Record money received',
    description:
      'Set against a month. Pay less than it asks and the shortfall carries forward; pay more and the credit does.',
  })
  create(@CurrentUser('ownerId') ownerId: string, @Body() dto: RecordPaymentDto) {
    return this.billing.recordPayment(ownerId, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billing.removePayment(ownerId, id);
  }
}

@ApiTags('ledger')
@ApiBearerAuth()
@Controller('leases/:leaseId/ledger')
export class LedgerController {
  constructor(
    private readonly billing: BillingService,
    private readonly ledger: LedgerService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'A tenancy month by month, with the carry-forward',
    description:
      'One query. Anything short of a month.s total carries into the next as dues; anything over carries as credit.',
  })
  async forLease(
    @CurrentUser('ownerId') ownerId: string,
    @Param('leaseId', ParseUUIDPipe) leaseId: string,
  ) {
    // Scope first, and by throwing: the ledger query below is keyed only by
    // lease, so an unowned id would otherwise return somebody else's ledger.
    await this.billing.assertLeaseOwned(ownerId, leaseId);
    const months = await this.ledger.forLease(leaseId);
    return { leaseId, months, summary: this.ledger.summarise(months) };
  }
}

@ApiTags('meter readings')
@ApiBearerAuth()
@Controller('units/:unitId/readings')
export class MeterReadingsController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @ApiOperation({ summary: 'Every reading taken on this unit.s meter' })
  findAll(
    @CurrentUser('ownerId') ownerId: string,
    @Param('unitId', ParseUUIDPipe) unitId: string,
  ) {
    return this.billing.findReadings(ownerId, unitId);
  }

  @Get('previous')
  @ApiQuery({ name: 'before', required: true, example: '2026-09-01' })
  @ApiOperation({
    summary: 'The reading a month opens from',
    description:
      'The last reading actually taken before that date — not last month.s, since an unbilled month still had the meter running.',
  })
  async previous(
    @CurrentUser('ownerId') ownerId: string,
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Query('before') before: string,
  ) {
    // findReadings asserts ownership of the unit and throws if it is not this
    // owner's; the lookup itself is keyed only by unit.
    await this.billing.findReadings(ownerId, unitId);
    return this.billing.previousReading(unitId, before);
  }

  @Post()
  create(
    @CurrentUser('ownerId') ownerId: string,
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Body() dto: CreateReadingDto,
  ) {
    return this.billing.createReading(ownerId, unitId, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('ownerId') ownerId: string,
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billing.removeReading(ownerId, unitId, id);
  }
}
