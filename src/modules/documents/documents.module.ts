import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { Document } from './entities/document.model';
import { Property } from '../properties/entities/property.model';
import { Lease } from '../leases/entities/lease.model';
import { Person } from '../people/entities/person.model';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [SequelizeModule.forFeature([Document, Property, Lease, Person])],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
