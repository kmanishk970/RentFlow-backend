import {
  BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey,
  HasMany, Model, PrimaryKey, Table, UpdatedAt,
} from 'sequelize-typescript';
import { Owner } from '../../owners/entities/owner.model';
import { Unit } from '../../properties/entities/unit.model';
import { LeaseOccupant } from './lease-occupant.model';
import { Bill } from '../../billing/entities/bill.model';
import { Payment } from '../../billing/entities/payment.model';
import { LeaseStatus, type Money } from '../../../common/domain.enums';

/**
 * A tenancy: a unit, a term, and the figures agreed for it.
 *
 * Who lives under it is LeaseOccupant. Postgres holds an exclusion constraint
 * that refuses two overlapping leases on the same unit, so a double-booking
 * fails at insert rather than at bill time.
 */
@Table({ tableName: 'leases', underscored: true })
export class Lease extends Model<Lease> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ForeignKey(() => Owner)
  @Column({ type: DataType.UUID, allowNull: false })
  ownerId: string;

  @ForeignKey(() => Unit)
  @Column({ type: DataType.UUID, allowNull: false })
  unitId: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  termStart: string;

  /** null = open-ended. */
  @Column(DataType.DATEONLY)
  termEnd: string | null;

  @Column({ type: DataType.DECIMAL(12, 2), allowNull: false })
  rent: Money;

  @Default('0')
  @Column({ type: DataType.DECIMAL(12, 2), allowNull: false })
  deposit: Money;

  @Default('0')
  @Column({ type: DataType.DECIMAL(12, 2), allowNull: false })
  depositReturned: Money;

  /** 1-28, so every month has the day. */
  @Default(5)
  @Column({ type: DataType.SMALLINT, allowNull: false })
  dueDay: number;

  @Default(LeaseStatus.Active)
  @Column({
    type: DataType.ENUM(...Object.values(LeaseStatus)),
    allowNull: false,
  })
  status: LeaseStatus;

  @Column(DataType.TEXT) emergencyName: string | null;
  @Column(DataType.TEXT) emergencyPhone: string | null;
  @Column(DataType.TEXT) note: string | null;

  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;

  @BelongsTo(() => Owner) owner: Owner;
  @BelongsTo(() => Unit) unit: Unit;
  @HasMany(() => LeaseOccupant) occupants: LeaseOccupant[];
  @HasMany(() => Bill) bills: Bill[];
  @HasMany(() => Payment) payments: Payment[];
}
