import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export const PROPERTY_KINDS = ['residential', 'commercial', 'mixed'] as const;

export class CreatePropertyDto {
  @ApiProperty({ example: 'Sunrise Apartments' })
  @IsString() @Length(2, 120)
  name: string;

  @ApiProperty({ example: 'Koramangala, Bangalore' })
  @IsString() @Length(2, 120)
  locality: string;

  @ApiProperty({ example: '42, 6th Main, Koramangala 4th Block' })
  @IsString() @Length(5, 240)
  address: string;

  @ApiProperty({ enum: PROPERTY_KINDS })
  @IsIn(PROPERTY_KINDS, { message: 'Kind must be residential, commercial or mixed' })
  kind: (typeof PROPERTY_KINDS)[number];

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  imageKey?: string;
}
