import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { Relation } from '../../../common/domain.enums';

/**
 * Hands the tenancy to somebody already on it.
 *
 * Nothing is overwritten: the outgoing primary keeps their row and becomes a
 * member, so the lease keeps its full occupancy history.
 */
export class ChangePrimaryDto {
  @ApiProperty({ description: 'The occupant being promoted' })
  @IsUUID('4', { message: 'Pick the member taking over' })
  occupantId: string;

  @ApiProperty({ enum: Relation, description: 'How the outgoing primary now relates to the new one' })
  @IsEnum(Relation, { message: 'Say how the outgoing tenant relates to the new one' })
  outgoingRelation: Relation;

  @ApiPropertyOptional({ description: 'Required when that relation is "other"' })
  @IsOptional() @IsString() @Length(2, 60)
  outgoingRelationNote?: string;

  @ApiPropertyOptional({ description: 'When the handover took effect' })
  @IsOptional() @IsDateString()
  effectiveFrom?: string;
}
