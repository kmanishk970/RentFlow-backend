import {
  BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey,
  HasMany, Model, PrimaryKey, Table, UpdatedAt,
} from 'sequelize-typescript';
import { Property } from './property.model';
import { Floor } from './floor.model';
import { Lease } from '../../leases/entities/lease.model';
import { MeterReading } from '../../billing/entities/meter-reading.model';
import type { Money } from '../../../common/domain.enums';

@Table({ tableName: 'units', underscored: true })
export class Unit extends Model<Unit> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ForeignKey(() => Floor)
  @Column({ type: DataType.UUID, allowNull: false })
  floorId: string;

  /**
   * Denormalised so owner-scoped queries are one join shallower. A composite
   * foreign key in the schema keeps it in step with the floor.
   */
  @ForeignKey(() => Property)
  @Column({ type: DataType.UUID, allowNull: false })
  propertyId: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  number: string;

  /** What a NEW lease is offered at. The agreed figures live on the lease. */
  @Column({ type: DataType.DECIMAL(12, 2), allowNull: false })
  defaultRent: Money;

  @Default('0')
  @Column({ type: DataType.DECIMAL(12, 2), allowNull: false })
  defaultDeposit: Money;

  /** Occupancy is derived from leases; this is the only real status column. */
  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  underMaintenance: boolean;

  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;

  @BelongsTo(() => Floor) floor: Floor;
  @BelongsTo(() => Property) property: Property;
  @HasMany(() => Lease) leases: Lease[];
  @HasMany(() => MeterReading) meterReadings: MeterReading[];
}
