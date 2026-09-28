import {
  BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey,
  HasMany, Model, PrimaryKey, Table, UpdatedAt,
} from 'sequelize-typescript';
import { Owner } from '../../owners/entities/owner.model';
import { LeaseOccupant } from '../../leases/entities/lease-occupant.model';
import { IdKind } from '../../../common/domain.enums';

/**
 * A human being, recorded once, whatever leases they turn up on.
 *
 * Kept separate from the tenancy: the frontend's `Tenant` was both at once,
 * which is why changing the primary tenant had to overwrite the person in place
 * and lost the outgoing one.
 */
@Table({ tableName: 'people', underscored: true })
export class Person extends Model<Person> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ForeignKey(() => Owner)
  @Column({ type: DataType.UUID, allowNull: false })
  ownerId: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  fullName: string;

  @Column(DataType.TEXT) phone: string | null;
  @Column(DataType.TEXT) email: string | null;
  @Column(DataType.TEXT) occupation: string | null;

  /** A date, not an age: an age is wrong again on the next birthday. */
  @Column(DataType.DATEONLY)
  dateOfBirth: string | null;

  @Column(DataType.TEXT) addressLine: string | null;
  @Column(DataType.TEXT) city: string | null;
  @Column(DataType.TEXT) state: string | null;
  @Column(DataType.TEXT) pincode: string | null;

  @Column(DataType.ENUM(...Object.values(IdKind)))
  idKind: IdKind | null;

  @Column(DataType.TEXT) idNumber: string | null;
  /** photoKey is Cloudinary's public id; photoUrl is what an <img> loads. */
  @Column(DataType.TEXT) photoKey: string | null;
  @Column(DataType.TEXT) photoUrl: string | null;

  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;

  @BelongsTo(() => Owner) owner: Owner;
  @HasMany(() => LeaseOccupant) occupancy: LeaseOccupant[];
}
