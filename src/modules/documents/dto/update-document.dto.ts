import { PartialType, PickType } from '@nestjs/swagger';
import { CreateDocumentDto } from './create-document.dto';

/**
 * Replacing a document's files, or renaming it.
 *
 * What it is filed against never changes here — a document that belongs to a
 * different lease or person is a different document. Only the title and the
 * images move, which is what re-photographing an ID card actually is.
 */
export class UpdateDocumentDto extends PartialType(
  PickType(CreateDocumentDto, [
    'title',
    'storageKey',
    'url',
    'resourceType',
    'originalName',
    'mimeType',
    'sizeBytes',
    'backStorageKey',
    'backUrl',
    'backResourceType',
  ] as const),
) {}
