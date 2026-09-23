import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray, IsDateString, IsEnum, IsNumberString, IsOptional,
  IsString, IsUUID, Length, Matches, ValidateNested,
} from 'class-validator';
import { ChargeKind, ElectricityMode } from '../../../common/domain.enums';

export class BillLineDto {
  @ApiProperty({ enum: ChargeKind })
  @IsEnum(ChargeKind)
  kind: ChargeKind;

  @ApiPropertyOptional({ example: 'Water tanker' })
  @IsOptional() @IsString() @Length(1, 60)
  label?: string;

  @ApiPropertyOptional({
    example: '620.00',
    description: 'Omit for a metered electricity line — it is derived from the readings',
  })
  @IsOptional() @IsNumberString({}, { message: 'Enter the amount as a number' })
  amount?: string;

  @ApiPropertyOptional({ enum: ElectricityMode })
  @IsOptional() @IsEnum(ElectricityMode)
  electricityMode?: ElectricityMode;

  @ApiPropertyOptional({ example: '4820.00' })
  @IsOptional() @IsNumberString()
  meterPrevious?: string;

  @ApiPropertyOptional({ example: '4882.00' })
  @IsOptional() @IsNumberString()
  meterCurrent?: string;

  @ApiPropertyOptional({ example: '10.00' })
  @IsOptional() @IsNumberString()
  unitRate?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID('4')
  previousReadingId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID('4')
  currentReadingId?: string;
}

export class CreateBillDto {
  @ApiProperty()
  @IsUUID('4', { message: 'Pick a lease' })
  leaseId: string;

  @ApiProperty({
    example: '2026-09',
    description: 'The month this bill covers. YYYY-MM or the first of the month.',
  })
  @Matches(/^[0-9]{4}-[0-9]{2}(-01)?$/, {
    message: 'Give the month as YYYY-MM',
  })
  period: string;

  @ApiPropertyOptional({
    example: '2026-09-05',
    description: 'Defaults to the lease.s due day in that month',
  })
  @IsOptional() @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 500)
  note?: string;

  @ApiProperty({ type: [BillLineDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => BillLineDto)
  lines: BillLineDto[];
}
