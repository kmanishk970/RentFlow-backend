import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
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

  @Delete(':id')
  remove(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documents.remove(ownerId, id);
  }
}
