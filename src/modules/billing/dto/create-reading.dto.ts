import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNumberString, IsOptional, IsString, Length } from 'class-validator';

export class CreateReadingDto {
  @ApiProperty({ example: '2026-09-01' })
  @IsDateString({}, { message: 'Enter the reading date as YYYY-MM-DD' })
  readOn: string;

  @ApiProperty({ example: '5125.00' })
  @IsNumberString({}, { message: 'Enter the reading as a number' })
  reading: string;

  @ApiPropertyOptional({
    default: false,
    description: 'The meter was replaced or rolled over — consumption is not computed across this row',
  })
  @IsOptional() @IsBoolean()
  startsNewMeter?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 200)
  note?: string;
}
