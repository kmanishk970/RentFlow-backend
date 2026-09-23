import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { LeasesService } from './leases.service';
import { CreateLeaseDto } from './dto/create-lease.dto';
import { UpdateLeaseDto } from './dto/update-lease.dto';
import { AddOccupantDto, UpdateOccupantDto } from './dto/occupant.dto';
import { ChangePrimaryDto } from './dto/change-primary.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LeaseStatus } from '../../common/domain.enums';

@ApiTags('leases')
@ApiBearerAuth()
@Controller('leases')
export class LeasesController {
  constructor(private readonly leases: LeasesService) {}

  @Get()
  @ApiQuery({ name: 'status', required: false, enum: LeaseStatus })
  @ApiQuery({ name: 'unitId', required: false })
  @ApiOperation({ summary: 'Tenancies, with their occupants and unit' })
  findAll(
    @CurrentUser('ownerId') ownerId: string,
    @Query('status') status?: LeaseStatus,
    @Query('unitId') unitId?: string,
  ) {
    return this.leases.findAll(ownerId, { status, unitId });
  }

  @Post()
  @ApiOperation({ summary: 'Start a tenancy, with its primary tenant and household' })
  create(@CurrentUser('ownerId') ownerId: string, @Body() dto: CreateLeaseDto) {
    return this.leases.create(ownerId, dto);
  }

  @Get(':id')
  findOne(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leases.findOne(ownerId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeaseDto,
  ) {
    return this.leases.update(ownerId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leases.remove(ownerId, id);
  }

  @Post(':id/occupants')
  @ApiOperation({ summary: 'Add somebody to the household' })
  addOccupant(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddOccupantDto,
  ) {
    return this.leases.addOccupant(ownerId, id, dto);
  }

  @Patch(':id/occupants/:occupantId')
  updateOccupant(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('occupantId', ParseUUIDPipe) occupantId: string,
    @Body() dto: UpdateOccupantDto,
  ) {
    return this.leases.updateOccupant(ownerId, id, occupantId, dto);
  }

  @Delete(':id/occupants/:occupantId')
  removeOccupant(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('occupantId', ParseUUIDPipe) occupantId: string,
  ) {
    return this.leases.removeOccupant(ownerId, id, occupantId);
  }

  @Post(':id/primary')
  @ApiOperation({
    summary: 'Hand the tenancy to a member',
    description:
      'The outgoing primary stays on the lease as a member, so the occupancy history survives.',
  })
  changePrimary(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePrimaryDto,
  ) {
    return this.leases.changePrimary(ownerId, id, dto);
  }
}
