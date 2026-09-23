import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean, IsNumberString, IsOptional, IsString, IsUUID, Length, Matches,
} from 'class-validator';

export class CreateUnitDto {
  @ApiProperty({ description: 'The floor this unit sits on' })
  @IsUUID('4', { message: 'Pick a floor' })
  floorId: string;

  @ApiProperty({ example: '101' })
  @IsString()
  @Length(1, 12)
  @Matches(/^[A-Za-z0-9-]+$/, { message: 'Letters, numbers and hyphens only' })
  number: string;

  /**
   * Money crosses the wire as a string all the way to the NUMERIC column.
   * Parsing it to a float here is exactly how rounding errors get in.
   */
  @ApiProperty({ example: '18000.00' })
  @IsNumberString({ no_symbols: false }, { message: 'Enter the rent as a number' })
  defaultRent: string;

  @ApiProperty({ example: '54000.00', required: false })
  @IsOptional()
  @IsNumberString({}, { message: 'Enter the deposit as a number' })
  defaultDeposit?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional() @IsBoolean()
  underMaintenance?: boolean;
}
