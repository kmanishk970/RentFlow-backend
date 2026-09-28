import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';

import { Document } from './entities/document.model';
import { Property } from '../properties/entities/property.model';
import { Lease } from '../leases/entities/lease.model';
import { Person } from '../people/entities/person.model';
import { MediaService } from '../media/media.service';
import { DocumentKind } from '../../common/domain.enums';
import type { CreateDocumentDto } from './dto/create-document.dto';
import type { UpdateDocumentDto } from './dto/update-document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(Document) private readonly documents: typeof Document,
    @InjectModel(Property) private readonly properties: typeof Property,
    @InjectModel(Lease) private readonly leases: typeof Lease,
    @InjectModel(Person) private readonly people: typeof Person,
    private readonly media: MediaService,
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
   * Records a file that has already gone up through POST /media/upload.
   *
   * Metadata only — the bytes are in Cloudinary by the time this is called,
   * and the caller passes back the url and public id it was given. Whatever
   * the document is filed against has to belong to the same owner, or a
   * document could be hung off somebody else's lease.
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

  /**
   * Deletes the record and the file behind it.
   *
   * The row goes first: a record left behind because storage was briefly
   * unreachable is the worse failure, and an orphaned asset only costs a
   * little space. `destroy` never throws, so it cannot block the delete.
   */
  /**
   * Replaces a document's files, or renames it.
   *
   * Re-photographing an ID card is an edit, not a second document: without
   * this the list fills with rows of the same name, and nobody can tell which
   * is current. Whatever it replaces is deleted from storage, because a file
   * no row points at is one nobody can ever reach again.
   */
  async update(ownerId: string, id: string, dto: UpdateDocumentDto) {
    const doc = await this.findOne(ownerId, id);

    const replaced: { key: string; type: string }[] = [];
    if (dto.storageKey && dto.storageKey !== doc.storageKey) {
      replaced.push({ key: doc.storageKey, type: doc.resourceType ?? 'image' });
    }
    if (dto.backStorageKey && dto.backStorageKey !== doc.backStorageKey && doc.backStorageKey) {
      replaced.push({
        key: doc.backStorageKey,
        type: doc.backResourceType ?? 'image',
      });
    }

    await doc.update({
      ...dto,
      ...(dto.sizeBytes === undefined ? {} : { sizeBytes: String(dto.sizeBytes) }),
    } as Partial<Document>);

    // After the row is saved, so a storage hiccup cannot leave the record
    // pointing at a file that has already been deleted.
    for (const { key, type } of replaced) {
      await this.media.destroy(key, type);
    }

    return doc;
  }

  async remove(ownerId: string, id: string) {
    const doc = await this.findOne(ownerId, id);
    const { storageKey, resourceType, backStorageKey, backResourceType } = doc;

    await doc.destroy();
    const fileDeleted = await this.media.destroy(
      storageKey,
      resourceType ?? 'image',
    );
    // Both sides go, or the back of a deleted ID card would sit in storage
    // forever with nothing referring to it.
    if (backStorageKey) {
      await this.media.destroy(backStorageKey, backResourceType ?? 'image');
    }

    return { id, storageKey, fileDeleted };
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
