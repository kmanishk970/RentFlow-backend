import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { OccupantInputDto } from './create-lease.dto';

export class AddOccupantDto extends OccupantInputDto {}

export class UpdateOccupantDto extends PartialType(OccupantInputDto) {
  @ApiPropertyOptional({ description: 'Records that they have left, without deleting the history' })
  @IsOptional() @IsDateString()
  movedOut?: string;
}
