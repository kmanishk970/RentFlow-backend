import {
  BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey,
  Model, PrimaryKey, Table, UpdatedAt,
} from 'sequelize-typescript';
import { Owner } from '../../owners/entities/owner.model';
import { Lease } from '../../leases/entities/lease.model';
import { PaymentMethod, type Money } from '../../../common/domain.enums';

/**
 * Money received, set against the month it settles.
 *
 * Deliberately not linked to a bill: a month can be paid before it is billed,
 * and one payment routinely clears arrears as well as the current month. The
 * ledger reconciles the two by period.
 */
@Table({ tableName: 'payments', underscored: true })
export class Payment extends Model<Payment> {
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

  @Column({ type: DataType.DECIMAL(12, 2), allowNull: false })
  amount: Money;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  paidOn: string;

  @Column({ type: DataType.ENUM(...Object.values(PaymentMethod)), allowNull: false })
  method: PaymentMethod;

  @Column(DataType.TEXT)
  reference: string | null;

  @Column(DataType.TEXT)
  note: string | null;

  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;

  @BelongsTo(() => Owner) owner: Owner;
  @BelongsTo(() => Lease) lease: Lease;
}
