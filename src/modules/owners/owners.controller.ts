import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OwnersService } from './owners.service';
import { UpdateOwnerDto } from './dto/update-owner.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('owner')
@ApiBearerAuth()
@Controller('me')
export class OwnersController {
  constructor(private readonly owners: OwnersService) {}

  @Get()
  @ApiOperation({ summary: 'The signed-in owner.s profile' })
  profile(@CurrentUser('ownerId') ownerId: string) {
    return this.owners.profile(ownerId);
  }

  @Patch()
  update(@CurrentUser('ownerId') ownerId: string, @Body() dto: UpdateOwnerDto) {
    return this.owners.update(ownerId, dto);
  }
}
