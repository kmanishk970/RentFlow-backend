import {
  BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey,
  Model, PrimaryKey, Table,
} from 'sequelize-typescript';
import { Owner } from '../../owners/entities/owner.model';
import { Unit } from '../../properties/entities/unit.model';
import type { Money } from '../../../common/domain.enums';

/**
 * A meter reading, logged against the unit.
 *
 * The meter is physical: it belongs to the unit, keeps counting across a change
 * of tenant, and can be read without billing anything.
 */
@Table({ tableName: 'meter_readings', underscored: true, updatedAt: false })
export class MeterReading extends Model<MeterReading> {
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
  readOn: string;

  @Column({ type: DataType.DECIMAL(12, 2), allowNull: false })
  reading: Money;

  /**
   * The meter was replaced or rolled over: this row opens a fresh count, and
   * consumption is never computed across it.
   */
  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  startsNewMeter: boolean;

  @Column(DataType.TEXT) note: string | null;

  @CreatedAt createdAt: Date;

  @BelongsTo(() => Owner) owner: Owner;
  @BelongsTo(() => Unit) unit: Unit;
}
