import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Owner } from './entities/owner.model';
import { OwnersController } from './owners.controller';
import { OwnersService } from './owners.service';

@Module({
  imports: [SequelizeModule.forFeature([Owner])],
  controllers: [OwnersController],
  providers: [OwnersService],
  exports: [OwnersService],
})
export class OwnersModule {}
