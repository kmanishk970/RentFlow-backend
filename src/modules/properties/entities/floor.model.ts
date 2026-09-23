import {
  BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey,
  HasMany, Model, PrimaryKey, Table,
} from 'sequelize-typescript';
import { Property } from './property.model';
import { Unit } from './unit.model';

@Table({ tableName: 'floors', underscored: true, updatedAt: false })
export class Floor extends Model<Floor> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ForeignKey(() => Property)
  @Column({ type: DataType.UUID, allowNull: false })
  propertyId: string;

  /** 0 = ground. */
  @Column({ type: DataType.SMALLINT, allowNull: false })
  level: number;

  @Column({ type: DataType.TEXT, allowNull: false })
  name: string;

  @CreatedAt createdAt: Date;

  @BelongsTo(() => Property) property: Property;
  @HasMany(() => Unit) units: Unit[];
}
