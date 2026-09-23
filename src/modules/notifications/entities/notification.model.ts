import {
  BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey,
  Model, PrimaryKey, Table,
} from 'sequelize-typescript';
import { Owner } from '../../owners/entities/owner.model';
import { Lease } from '../../leases/entities/lease.model';
import { NotificationKind } from '../../../common/domain.enums';

@Table({ tableName: 'notifications', underscored: true, updatedAt: false })
export class Notification extends Model<Notification> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ForeignKey(() => Owner)
  @Column({ type: DataType.UUID, allowNull: false })
  ownerId: string;

  @Column({ type: DataType.ENUM(...Object.values(NotificationKind)), allowNull: false })
  kind: NotificationKind;

  @Column({ type: DataType.TEXT, allowNull: false })
  title: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  body: string;

  @ForeignKey(() => Lease)
  @Column(DataType.UUID)
  leaseId: string | null;

  /** A timestamp, not a boolean: it also tells you when. */
  @Column(DataType.DATE)
  readAt: Date | null;

  @CreatedAt createdAt: Date;

  @BelongsTo(() => Owner) owner: Owner;
  @BelongsTo(() => Lease) lease: Lease | null;
}
