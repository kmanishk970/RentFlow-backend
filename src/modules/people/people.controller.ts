import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { PeopleService } from './people.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('people')
@ApiBearerAuth()
@Controller('people')
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  @ApiQuery({ name: 'search', required: false })
  @ApiOperation({ summary: 'Everybody on file, whatever leases they are on' })
  findAll(
    @CurrentUser('ownerId') ownerId: string,
    @Query('search') search?: string,
  ) {
    return this.people.findAll(ownerId, search);
  }

  @Post()
  create(@CurrentUser('ownerId') ownerId: string, @Body() dto: CreatePersonDto) {
    return this.people.create(ownerId, dto);
  }

  @Get(':id')
  findOne(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.people.findOne(ownerId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePersonDto,
  ) {
    return this.people.update(ownerId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.people.remove(ownerId, id);
  }
}
