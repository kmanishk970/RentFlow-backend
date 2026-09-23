import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateUnitDto } from './create-unit.dto';

/** A unit does not move between floors; delete and recreate instead. */
export class UpdateUnitDto extends PartialType(
  OmitType(CreateUnitDto, ['floorId'] as const),
) {}
