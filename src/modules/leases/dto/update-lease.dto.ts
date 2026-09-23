import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateLeaseDto } from './create-lease.dto';
import { LeaseStatus } from '../../../common/domain.enums';

/**
 * The unit and the people on a lease are not edited here — moving a tenancy to
 * another unit is a new lease, and occupants have their own endpoints.
 */
export class UpdateLeaseDto extends PartialType(
  OmitType(CreateLeaseDto, [
    'unitId', 'primaryPersonId', 'primaryPerson', 'members',
  ] as const),
) {
  @ApiPropertyOptional({ enum: LeaseStatus })
  @IsOptional() @IsEnum(LeaseStatus)
  status?: LeaseStatus;
}
