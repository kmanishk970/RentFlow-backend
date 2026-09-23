import {
  BelongsTo, Column, DataType, Default, ForeignKey,
  Model, PrimaryKey, Table,
} from 'sequelize-typescript';
import { Bill } from './bill.model';
import { MeterReading } from './meter-reading.model';
import {
  ChargeKind, ElectricityMode, type Money,
} from '../../../common/domain.enums';

/**
 * One charge on a bill — rent, electricity, or anything else added on top.
 *
 * Line items rather than fixed columns, because a single "other charges" slot
 * cannot hold water and maintenance at the same time.
 */
@Table({ tableName: 'bill_lines', underscored: true, timestamps: false })
export class BillLine extends Model<BillLine> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ForeignKey(() => Bill)
  @Column({ type: DataType.UUID, allowNull: false })
  billId: string;

  @Column({ type: DataType.ENUM(...Object.values(ChargeKind)), allowNull: false })
  kind: ChargeKind;

  @Column(DataType.TEXT)
  label: string | null;

  @Column({ type: DataType.DECIMAL(12, 2), allowNull: false })
  amount: Money;

  /**
   * The electricity working, frozen at billing time. A bill is a financial
   * document: correcting a reading later must not rewrite what was charged.
   */
  @Column(DataType.ENUM(...Object.values(ElectricityMode)))
  electricityMode: ElectricityMode | null;

  @Column(DataType.DECIMAL(12, 2))
  meterPrevious: Money | null;

  @Column(DataType.DECIMAL(12, 2))
  meterCurrent: Money | null;

  @Column(DataType.DECIMAL(8, 2))
  unitRate: Money | null;

  /** Provenance only — the frozen figures above are what was billed. */
  @ForeignKey(() => MeterReading)
  @Column(DataType.UUID)
  previousReadingId: string | null;

  @ForeignKey(() => MeterReading)
  @Column(DataType.UUID)
  currentReadingId: string | null;

  @BelongsTo(() => Bill)
  bill: Bill;

  @BelongsTo(() => MeterReading, 'previousReadingId')
  previousReading: MeterReading | null;

  @BelongsTo(() => MeterReading, 'currentReadingId')
  currentReading: MeterReading | null;
}
