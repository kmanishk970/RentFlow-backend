import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { CreateFloorDto } from './dto/create-floor.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('properties')
@ApiBearerAuth()
@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  @ApiOperation({ summary: 'Every property, with its floors and units' })
  findAll(@CurrentUser('ownerId') ownerId: string) {
    return this.properties.findAll(ownerId);
  }

  @Post()
  create(@CurrentUser('ownerId') ownerId: string, @Body() dto: CreatePropertyDto) {
    return this.properties.create(ownerId, dto);
  }

  @Get(':id')
  findOne(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.properties.findOne(ownerId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.properties.update(ownerId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.properties.remove(ownerId, id);
  }

  @Post(':id/floors')
  @ApiOperation({ summary: 'Add a floor to a property' })
  addFloor(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFloorDto,
  ) {
    return this.properties.addFloor(ownerId, id, dto);
  }

  @Delete(':id/floors/:floorId')
  removeFloor(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('floorId', ParseUUIDPipe) floorId: string,
  ) {
    return this.properties.removeFloor(ownerId, id, floorId);
  }

  @Post(':id/units')
  @ApiOperation({ summary: 'Add a unit to one of the property.s floors' })
  addUnit(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateUnitDto,
  ) {
    return this.properties.addUnit(ownerId, id, dto);
  }
}

@ApiTags('units')
@ApiBearerAuth()
@Controller('units')
export class UnitsController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  @ApiOperation({ summary: 'Every unit, flattened, with derived occupancy' })
  findAll(@CurrentUser('ownerId') ownerId: string) {
    return this.properties.findUnits(ownerId);
  }

  @Get(':id')
  findOne(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.properties.findUnit(ownerId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUnitDto,
  ) {
    return this.properties.updateUnit(ownerId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.properties.removeUnit(ownerId, id);
  }
}
