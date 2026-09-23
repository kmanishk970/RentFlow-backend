import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { Lease } from './entities/lease.model';
import { LeaseOccupant } from './entities/lease-occupant.model';
import { Person } from '../people/entities/person.model';
import { Unit } from '../properties/entities/unit.model';
import { LeasesController } from './leases.controller';
import { LeasesService } from './leases.service';

@Module({
  imports: [SequelizeModule.forFeature([Lease, LeaseOccupant, Person, Unit])],
  controllers: [LeasesController],
  providers: [LeasesService],
  exports: [LeasesService],
})
export class LeasesModule {}
