import {
  BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey,
  HasMany, Model, PrimaryKey, Table, UpdatedAt,
} from 'sequelize-typescript';
import { Owner } from '../../owners/entities/owner.model';
import { Floor } from './floor.model';
import { Unit } from './unit.model';

@Table({ tableName: 'properties', underscored: true })
export class Property extends Model<Property> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ForeignKey(() => Owner)
  @Column({ type: DataType.UUID, allowNull: false })
  ownerId: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  name: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  locality: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  address: string;

  /** residential | commercial | mixed — held by a check constraint. */
  @Column({ type: DataType.TEXT, allowNull: false })
  kind: string;

  @Column(DataType.TEXT)
  imageKey: string | null;

  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;

  @BelongsTo(() => Owner) owner: Owner;
  @HasMany(() => Floor) floors: Floor[];
  @HasMany(() => Unit) units: Unit[];
}
