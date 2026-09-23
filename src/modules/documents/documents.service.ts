import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';

import { Document } from './entities/document.model';
import { Property } from '../properties/entities/property.model';
import { Lease } from '../leases/entities/lease.model';
import { Person } from '../people/entities/person.model';
import { DocumentKind } from '../../common/domain.enums';
import type { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(Document) private readonly documents: typeof Document,
    @InjectModel(Property) private readonly properties: typeof Property,
    @InjectModel(Lease) private readonly leases: typeof Lease,
    @InjectModel(Person) private readonly people: typeof Person,
  ) {}

  findAll(ownerId: string, filters: { kind?: DocumentKind; leaseId?: string; personId?: string } = {}) {
    return this.documents.findAll({
      where: {
        ownerId,
        ...(filters.kind ? { kind: filters.kind } : {}),
        ...(filters.leaseId ? { leaseId: filters.leaseId } : {}),
        ...(filters.personId ? { personId: filters.personId } : {}),
      },
      order: [['uploadedAt', 'DESC']],
    });
  }

  async findOne(ownerId: string, id: string) {
    const doc = await this.documents.findOne({ where: { id, ownerId } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  /**
   * Records a file that has already been uploaded to object storage.
   *
   * Metadata only: the bytes never pass through the API. Whatever this is
   * filed against has to belong to the same owner, or a document could be
   * hung off somebody else's lease.
   */
  async create(ownerId: string, dto: CreateDocumentDto) {
    if (dto.propertyId) await this.assert(this.properties, ownerId, dto.propertyId, 'Property');
    if (dto.leaseId) await this.assert(this.leases, ownerId, dto.leaseId, 'Lease');
    if (dto.personId) await this.assert(this.people, ownerId, dto.personId, 'Person');

    return this.documents.create({
      ...dto,
      ownerId,
      sizeBytes: String(dto.sizeBytes),
    } as Partial<Document> as Document);
  }

  async remove(ownerId: string, id: string) {
    const doc = await this.findOne(ownerId, id);
    const { storageKey } = doc;
    await doc.destroy();
    // The caller deletes the object itself; returning the key saves them a
    // second round trip to find out what to delete.
    return { id, storageKey };
  }

  private async assert(
    model: { findOne(options: object): Promise<unknown> },
    ownerId: string,
    id: string,
    label: string,
  ) {
    const found = await model.findOne({ where: { id, ownerId }, attributes: ['id'] });
    if (!found) throw new NotFoundException(`${label} not found`);
  }
}
