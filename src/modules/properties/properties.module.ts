import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { Property } from './entities/property.model';
import { Floor } from './entities/floor.model';
import { Unit } from './entities/unit.model';
import { Lease } from '../leases/entities/lease.model';
import { PropertiesController, UnitsController } from './properties.controller';
import { PropertiesService } from './properties.service';

@Module({
  imports: [SequelizeModule.forFeature([Property, Floor, Unit, Lease])],
  controllers: [PropertiesController, UnitsController],
  providers: [PropertiesService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
