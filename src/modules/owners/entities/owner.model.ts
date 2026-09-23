import {
  Column,
  CreatedAt,
  DataType,
  Default,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { Property } from '../../properties/entities/property.model';
import { Person } from '../../people/entities/person.model';
import { Lease } from '../../leases/entities/lease.model';
import type { Money } from '../../../common/domain.enums';

/** The root every other row hangs off. One login owns one portfolio. */
@Table({ tableName: 'owners', underscored: true })
export class Owner extends Model<Owner> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  /** Stored lowercased — a check constraint in the database enforces it. */
  @Column({ type: DataType.TEXT, allowNull: false, unique: true })
  email: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  passwordHash: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  name: string;

  @Column(DataType.TEXT)
  phone: string | null;

  @Column(DataType.TEXT)
  company: string | null;

  @Column(DataType.TEXT)
  address: string | null;

  @Column(DataType.TEXT)
  photoKey: string | null;

  @Default('free')
  @Column({ type: DataType.TEXT, allowNull: false })
  plan: string;

  /** Default tariff, copied onto each bill so a rise is never retroactive. */
  @Default('10')
  @Column({ type: DataType.DECIMAL(8, 2), allowNull: false })
  electricityRate: Money;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => Property)
  properties: Property[];

  @HasMany(() => Person)
  people: Person[];

  @HasMany(() => Lease)
  leases: Lease[];
}
