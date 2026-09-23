import {
  BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey,
  HasMany, Model, PrimaryKey, Table, UpdatedAt,
} from 'sequelize-typescript';
import { Owner } from '../../owners/entities/owner.model';
import { Lease } from '../../leases/entities/lease.model';
import { BillLine } from './bill-line.model';

/**
 * What a tenancy owes for one month.
 *
 * `period` is the first of the month it covers, as a date — it sorts and does
 * arithmetic, which the frontend's "2026-09" string could not. A unique index
 * on (lease, period) means re-billing a month replaces it rather than doubling
 * what is owed.
 */
@Table({ tableName: 'bills', underscored: true })
export class Bill extends Model<Bill> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ForeignKey(() => Owner)
  @Column({ type: DataType.UUID, allowNull: false })
  ownerId: string;

  @ForeignKey(() => Lease)
  @Column({ type: DataType.UUID, allowNull: false })
  leaseId: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  period: string;

  /** After this the month counts as overdue rather than pending. */
  @Column({ type: DataType.DATEONLY, allowNull: false })
  dueDate: string;

  @Column(DataType.TEXT)
  note: string | null;

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE, allowNull: false })
  issuedAt: Date;

  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;

  @BelongsTo(() => Owner) owner: Owner;
  @BelongsTo(() => Lease) lease: Lease;
  @HasMany(() => BillLine) lines: BillLine[];
}
