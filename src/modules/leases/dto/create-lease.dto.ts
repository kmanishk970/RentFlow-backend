import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray, IsDateString, IsEnum, IsInt, IsNumberString, IsOptional,
  IsString, IsUUID, Length, Max, Min, ValidateNested,
} from 'class-validator';
import { CreatePersonDto } from '../../people/dto/create-person.dto';
import { Relation } from '../../../common/domain.enums';

/** Somebody joining the household alongside the primary tenant. */
export class OccupantInputDto {
  @ApiPropertyOptional({ description: 'An existing person, if they are already on file' })
  @IsOptional() @IsUUID('4')
  personId?: string;

  @ApiPropertyOptional({ type: CreatePersonDto, description: 'Or their details, to create them' })
  @IsOptional() @ValidateNested() @Type(() => CreatePersonDto)
  person?: CreatePersonDto;

  @ApiProperty({ enum: Relation })
  @IsEnum(Relation, { message: 'Pick how this person relates to the primary tenant' })
  relation: Relation;

  @ApiPropertyOptional({ description: 'Required when the relation is "other"' })
  @IsOptional() @IsString() @Length(2, 60)
  relationNote?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional() @IsDateString()
  movedIn?: string;
}

export class CreateLeaseDto {
  @ApiProperty()
  @IsUUID('4', { message: 'Pick a unit' })
  unitId: string;

  @ApiPropertyOptional({ description: 'An existing person to put on the lease' })
  @IsOptional() @IsUUID('4')
  primaryPersonId?: string;

  @ApiPropertyOptional({ type: CreatePersonDto, description: 'Or their details, to create them' })
  @IsOptional() @ValidateNested() @Type(() => CreatePersonDto)
  primaryPerson?: CreatePersonDto;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString({}, { message: 'Enter the start date as YYYY-MM-DD' })
  termStart: string;

  @ApiPropertyOptional({ example: '2027-01-01', description: 'Omit for an open-ended lease' })
  @IsOptional() @IsDateString()
  termEnd?: string;

  @ApiProperty({ example: '18000.00' })
  @IsNumberString({}, { message: 'Enter the rent as a number' })
  rent: string;

  @ApiPropertyOptional({ example: '54000.00' })
  @IsOptional() @IsNumberString({}, { message: 'Enter the deposit as a number' })
  deposit?: string;

  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 28 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(28)
  dueDay?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 80)
  emergencyName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(8, 20)
  emergencyPhone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 500)
  note?: string;

  @ApiPropertyOptional({ type: [OccupantInputDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OccupantInputDto)
  members?: OccupantInputDto[];
}
