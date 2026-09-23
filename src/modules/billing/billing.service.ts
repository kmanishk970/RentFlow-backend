import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize';

import { Bill } from './entities/bill.model';
import { BillLine } from './entities/bill-line.model';
import { Payment } from './entities/payment.model';
import { MeterReading } from './entities/meter-reading.model';
import { Lease } from '../leases/entities/lease.model';
import { Unit } from '../properties/entities/unit.model';
import { Property } from '../properties/entities/property.model';
import { ChargeKind, ElectricityMode } from '../../common/domain.enums';

import type { BillLineDto, CreateBillDto } from './dto/create-bill.dto';
import type { RecordPaymentDto } from './dto/record-payment.dto';
import type { CreateReadingDto } from './dto/create-reading.dto';

/** "2026-09" and "2026-09-01" both mean the same month. */
const asMonth = (period: string) =>
  period.length === 7 ? `${period}-01` : period;

@Injectable()
export class BillingService {
  constructor(
    @InjectModel(Bill) private readonly bills: typeof Bill,
    @InjectModel(BillLine) private readonly lines: typeof BillLine,
    @InjectModel(Payment) private readonly payments: typeof Payment,
    @InjectModel(MeterReading) private readonly readings: typeof MeterReading,
    @InjectModel(Lease) private readonly leases: typeof Lease,
    @InjectModel(Unit) private readonly units: typeof Unit,
    private readonly sequelize: Sequelize,
  ) {}

  /* --------------------------------------------------------------------- */
  /* Bills                                                                  */
  /* --------------------------------------------------------------------- */

  findBills(ownerId: string, leaseId?: string) {
    return this.bills.findAll({
      where: { ownerId, ...(leaseId ? { leaseId } : {}) },
      include: [{ model: BillLine }],
      order: [['period', 'DESC']],
    });
  }

  async findBill(ownerId: string, id: string) {
    const bill = await this.bills.findOne({
      where: { id, ownerId },
      include: [{ model: BillLine }],
    });
    if (!bill) throw new NotFoundException('Bill not found');
    return bill;
  }

  /**
   * Raises a month's charges, or replaces them if the month is already billed.
   *
   * Replacing rather than adding is deliberate, and the database agrees: a
   * unique index on (lease, period) means a second bill for the same month
   * cannot exist. Billing a month twice should correct it, never double it.
   */
  async createBill(ownerId: string, dto: CreateBillDto) {
    const lease = await this.assertLease(ownerId, dto.leaseId);
    const period = asMonth(dto.period);

    if (!dto.lines?.length) {
      throw new BadRequestException('A bill needs at least one charge');
    }

    const lines = dto.lines.map((line) => this.resolveLine(line));
    const dueDate = dto.dueDate ?? this.defaultDueDate(period, lease.dueDay);

    return this.sequelize.transaction(async (tx) => {
      const existing = await this.bills.findOne({
        where: { leaseId: lease.id, period },
        transaction: tx,
      });

      if (existing) {
        await this.lines.destroy({
          where: { billId: existing.id },
          transaction: tx,
        });
        await existing.update({ dueDate, note: dto.note ?? null }, { transaction: tx });
        await this.lines.bulkCreate(
          lines.map((l) => ({ ...l, billId: existing.id })) as Partial<BillLine>[] as BillLine[],
          { transaction: tx },
        );
        return this.bills.findByPk(existing.id, {
          include: [{ model: BillLine }],
          transaction: tx,
        });
      }

      const bill = await this.bills.create(
        {
          ownerId,
          leaseId: lease.id,
          period,
          dueDate,
          note: dto.note ?? null,
        } as Partial<Bill> as Bill,
        { transaction: tx },
      );

      await this.lines.bulkCreate(
        lines.map((l) => ({ ...l, billId: bill.id })) as Partial<BillLine>[] as BillLine[],
        { transaction: tx },
      );

      return this.bills.findByPk(bill.id, {
        include: [{ model: BillLine }],
        transaction: tx,
      });
    });
  }

  async removeBill(ownerId: string, id: string) {
    const bill = await this.findBill(ownerId, id);
    await bill.destroy();
    return { id };
  }

  /**
   * Works out a line's amount.
   *
   * A metered electricity line is derived from its readings rather than trusted
   * from the request — the amount and the working must agree, and the readings
   * are the ones that will be shown on the bill.
   */
  private resolveLine(line: BillLineDto): Partial<BillLine> {
    if (
      line.kind === ChargeKind.Electricity &&
      line.electricityMode === ElectricityMode.Meter
    ) {
      const previous = Number(line.meterPrevious);
      const current = Number(line.meterCurrent);
      const rate = Number(line.unitRate);

      if (!Number.isFinite(previous) || !Number.isFinite(current) || !Number.isFinite(rate)) {
        throw new BadRequestException(
          'A metered electricity charge needs both readings and a rate',
        );
      }
      if (current < previous) {
        throw new BadRequestException(
          'The closing reading is below the opening one. A meter counts up — if it was replaced, bill that month flat.',
        );
      }

      return {
        kind: line.kind,
        label: line.label ?? null,
        amount: ((current - previous) * rate).toFixed(2),
        electricityMode: ElectricityMode.Meter,
        meterPrevious: previous.toFixed(2),
        meterCurrent: current.toFixed(2),
        unitRate: rate.toFixed(2),
        previousReadingId: line.previousReadingId ?? null,
        currentReadingId: line.currentReadingId ?? null,
      };
    }

    if (line.amount === undefined) {
      throw new BadRequestException(`The ${line.kind} charge needs an amount`);
    }

    return {
      kind: line.kind,
      label: line.label ?? null,
      amount: Number(line.amount).toFixed(2),
      electricityMode:
        line.kind === ChargeKind.Electricity ? ElectricityMode.Flat : null,
    };
  }

  private defaultDueDate(period: string, dueDay: number) {
    const day = String(dueDay).padStart(2, '0');
    return `${period.slice(0, 7)}-${day}`;
  }

  /* --------------------------------------------------------------------- */
  /* Payments                                                               */
  /* --------------------------------------------------------------------- */

  findPayments(ownerId: string, leaseId?: string) {
    return this.payments.findAll({
      where: { ownerId, ...(leaseId ? { leaseId } : {}) },
      order: [['paidOn', 'DESC']],
    });
  }

  async recordPayment(ownerId: string, dto: RecordPaymentDto) {
    await this.assertLease(ownerId, dto.leaseId);

    // Payments accumulate: a month can be settled in several instalments, and
    // one payment routinely clears arrears as well as the current month.
    return this.payments.create({
      ownerId,
      leaseId: dto.leaseId,
      period: asMonth(dto.period),
      amount: Number(dto.amount).toFixed(2),
      paidOn: dto.paidOn,
      method: dto.method,
      reference: dto.reference ?? null,
      note: dto.note ?? null,
    } as Partial<Payment> as Payment);
  }

  async removePayment(ownerId: string, id: string) {
    const payment = await this.payments.findOne({ where: { id, ownerId } });
    if (!payment) throw new NotFoundException('Payment not found');
    await payment.destroy();
    return { id };
  }

  /* --------------------------------------------------------------------- */
  /* Meter readings                                                         */
  /* --------------------------------------------------------------------- */

  async findReadings(ownerId: string, unitId: string) {
    await this.assertUnit(ownerId, unitId);
    return this.readings.findAll({
      where: { unitId },
      order: [['readOn', 'DESC']],
    });
  }

  async createReading(ownerId: string, unitId: string, dto: CreateReadingDto) {
    await this.assertUnit(ownerId, unitId);

    // A meter only climbs, so a reading below the one before it is either a
    // typo or a replaced meter — and the second has its own flag.
    if (!dto.startsNewMeter) {
      const previous = await this.previousReading(unitId, dto.readOn);
      if (previous && Number(dto.reading) < Number(previous.reading)) {
        throw new BadRequestException(
          `That is below the reading of ${previous.reading} taken on ${previous.readOn}. If the meter was replaced, mark it as starting a new meter.`,
        );
      }
    }

    return this.readings.create({
      ownerId,
      unitId,
      readOn: dto.readOn,
      reading: Number(dto.reading).toFixed(2),
      startsNewMeter: dto.startsNewMeter ?? false,
      note: dto.note ?? null,
    } as Partial<MeterReading> as MeterReading);
  }

  /**
   * The reading a month opens from.
   *
   * Deliberately not "last month": if a month was never billed the meter still
   * ran through it, so the figure to subtract from is the last reading actually
   * taken. The meter belongs to the unit, so this crosses tenancies.
   */
  async previousReading(unitId: string, before: string) {
    return this.readings.findOne({
      where: { unitId, readOn: { [Op.lt]: before } },
      order: [['readOn', 'DESC']],
    });
  }

  async removeReading(ownerId: string, unitId: string, id: string) {
    await this.assertUnit(ownerId, unitId);
    const deleted = await this.readings.destroy({ where: { id, unitId } });
    if (!deleted) throw new NotFoundException('Reading not found');
    return { id };
  }

  /* --------------------------------------------------------------------- */
  /* Guards                                                                 */
  /* --------------------------------------------------------------------- */

  /**
   * Public, because the ledger endpoint needs it. findBills() returns an empty
   * array for a lease that is not yours, which reads like a guard and is not
   * one — it lets a foreign lease id through to a query keyed only by lease.
   */
  async assertLeaseOwned(ownerId: string, leaseId: string) {
    return this.assertLease(ownerId, leaseId);
  }

  private async assertLease(ownerId: string, leaseId: string) {
    const lease = await this.leases.findOne({ where: { id: leaseId, ownerId } });
    if (!lease) throw new NotFoundException('Lease not found');
    return lease;
  }

  private async assertUnit(ownerId: string, unitId: string) {
    const unit = await this.units.findOne({
      where: { id: unitId },
      include: [{ model: Property, where: { ownerId }, attributes: [] }],
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }
}
