import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Person } from './entities/person.model';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';

@Module({
  imports: [SequelizeModule.forFeature([Person])],
  controllers: [PeopleController],
  providers: [PeopleService],
  exports: [PeopleService],
})
export class PeopleModule {}
