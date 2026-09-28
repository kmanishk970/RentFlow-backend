import { ApiProperty } from '@nestjs/swagger';
import { IsNumberString, IsOptional, IsString, Length } from 'class-validator';

export class UpdateOwnerDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() @Length(2, 80)
  name?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @Length(8, 20)
  phone?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @Length(0, 120)
  company?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @Length(0, 240)
  address?: string;

  @ApiProperty({ required: false, description: "Cloudinary public id, from POST /media/upload" })
  @IsOptional() @IsString() @Length(0, 400)
  photoKey?: string;

  @ApiProperty({ required: false, description: 'Delivery URL, from POST /media/upload' })
  @IsOptional() @IsString() @Length(0, 2000)
  photoUrl?: string;

  @ApiProperty({ required: false, example: '10.00', description: 'Default rupees per electricity unit' })
  @IsOptional()
  @IsNumberString({}, { message: 'Enter the rate as a number' })
  electricityRate?: string;
}
