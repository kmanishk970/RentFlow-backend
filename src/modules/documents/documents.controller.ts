import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DocumentKind } from '../../common/domain.enums';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @ApiQuery({ name: 'kind', required: false, enum: DocumentKind })
  @ApiQuery({ name: 'leaseId', required: false })
  @ApiQuery({ name: 'personId', required: false })
  findAll(
    @CurrentUser('ownerId') ownerId: string,
    @Query('kind') kind?: DocumentKind,
    @Query('leaseId') leaseId?: string,
    @Query('personId') personId?: string,
  ) {
    return this.documents.findAll(ownerId, { kind, leaseId, personId });
  }

  @Post()
  @ApiOperation({
    summary: 'Record a file already uploaded to storage',
    description: 'Metadata only — the bytes never pass through the API.',
  })
  create(@CurrentUser('ownerId') ownerId: string, @Body() dto: CreateDocumentDto) {
    return this.documents.create(ownerId, dto);
  }

  @Get(':id')
  findOne(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documents.findOne(ownerId, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Replace the files on a document, or rename it',
    description:
      'Re-photographing an ID card edits the record rather than adding a ' +
      'second one. Files it replaces are deleted from storage.',
  })
  update(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documents.update(ownerId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documents.remove(ownerId, id);
  }
}
