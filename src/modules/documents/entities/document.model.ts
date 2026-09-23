import {
  BelongsTo, Column, DataType, Default, ForeignKey,
  Model, PrimaryKey, Table,
} from 'sequelize-typescript';
import { Owner } from '../../owners/entities/owner.model';
import { Property } from '../../properties/entities/property.model';
import { Lease } from '../../leases/entities/lease.model';
import { Person } from '../../people/entities/person.model';
import { DocumentKind } from '../../../common/domain.enums';

/** Metadata. The bytes live in object storage under `storageKey`. */
@Table({ tableName: 'documents', underscored: true, timestamps: false })
export class Document extends Model<Document> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ForeignKey(() => Owner)
  @Column({ type: DataType.UUID, allowNull: false })
  ownerId: string;

  @Column({ type: DataType.ENUM(...Object.values(DocumentKind)), allowNull: false })
  kind: DocumentKind;

  @Column({ type: DataType.TEXT, allowNull: false })
  title: string;

  /** Filed against any of these, or none. */
  @ForeignKey(() => Property)
  @Column(DataType.UUID)
  propertyId: string | null;

  @ForeignKey(() => Lease)
  @Column(DataType.UUID)
  leaseId: string | null;

  @ForeignKey(() => Person)
  @Column(DataType.UUID)
  personId: string | null;

  @Column({ type: DataType.TEXT, allowNull: false, unique: true })
  storageKey: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  originalName: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  mimeType: string;

  /** BIGINT arrives as a string, like every other exact numeric here. */
  @Column({ type: DataType.BIGINT, allowNull: false })
  sizeBytes: string;

  @Default(DataType.NOW)
  @Column({ type: DataType.DATE, allowNull: false })
  uploadedAt: Date;

  @BelongsTo(() => Owner) owner: Owner;
  @BelongsTo(() => Property) property: Property | null;
  @BelongsTo(() => Lease) lease: Lease | null;
  @BelongsTo(() => Person) person: Person | null;
}
