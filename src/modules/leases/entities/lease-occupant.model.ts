import {
  BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey,
  Model, PrimaryKey, Table,
} from 'sequelize-typescript';
import { Lease } from './lease.model';
import { Person } from '../../people/entities/person.model';
import { OccupantRole, Relation } from '../../../common/domain.enums';

/**
 * Who lives on a lease, and in what capacity.
 *
 * Changing the primary tenant is a role update here — no data is overwritten
 * and the outgoing tenant keeps their row. A partial unique index in Postgres
 * allows at most one current primary per lease.
 */
@Table({ tableName: 'lease_occupants', underscored: true, updatedAt: false })
export class LeaseOccupant extends Model<LeaseOccupant> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ForeignKey(() => Lease)
  @Column({ type: DataType.UUID, allowNull: false })
  leaseId: string;

  @ForeignKey(() => Person)
  @Column({ type: DataType.UUID, allowNull: false })
  personId: string;

  @Column({
    type: DataType.ENUM(...Object.values(OccupantRole)),
    allowNull: false,
  })
  role: OccupantRole;

  /** How this person relates to the primary; null on the primary itself. */
  @Column(DataType.ENUM(...Object.values(Relation)))
  relation: Relation | null;

  /** Required when the relation is "other" — the escape hatch is spelled out. */
  @Column(DataType.TEXT)
  relationNote: string | null;

  @Column(DataType.DATEONLY) movedIn: string | null;
  @Column(DataType.DATEONLY) movedOut: string | null;

  @CreatedAt createdAt: Date;

  @BelongsTo(() => Lease) lease: Lease;
  @BelongsTo(() => Person) person: Person;
}
