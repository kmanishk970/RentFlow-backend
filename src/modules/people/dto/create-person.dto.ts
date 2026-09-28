import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString, IsEmail, IsEnum, IsOptional, IsString, Length, Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IdKind } from '../../../common/domain.enums';

export class CreatePersonDto {
  @ApiProperty({ example: 'Arjun Mehta' })
  @IsString() @Length(2, 80)
  fullName: string;

  @ApiProperty({ required: false, example: '+91 98765 43210' })
  @IsOptional() @IsString() @Length(8, 20)
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid email address' })
  @Transform(({ value }) => (value ? String(value).trim().toLowerCase() : value))
  email?: string;

  @ApiProperty({ required: false, example: 'Software Engineer' })
  @IsOptional() @IsString() @Length(2, 80)
  occupation?: string;

  @ApiProperty({
    required: false,
    example: '1992-04-18',
    description: 'A date, not an age — an age is wrong again on the next birthday',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Enter the date of birth as YYYY-MM-DD' })
  dateOfBirth?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @Length(2, 160)
  addressLine?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @Length(2, 60)
  city?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @Length(2, 60)
  state?: string;

  @ApiProperty({ required: false, example: '560001' })
  @IsOptional()
  @Matches(/^[1-9][0-9]{5}$/, { message: 'Enter a valid 6-digit PIN code' })
  pincode?: string;

  @ApiProperty({ required: false, enum: IdKind })
  @IsOptional() @IsEnum(IdKind)
  idKind?: IdKind;

  @ApiProperty({ required: false, example: '2345 6789 0123' })
  @IsOptional() @IsString() @Length(4, 40)
  idNumber?: string;

  @ApiProperty({ required: false, description: "Cloudinary public id, from POST /media/upload" })
  @IsOptional() @IsString() @Length(0, 400)
  photoKey?: string;

  @ApiProperty({ required: false, description: 'Delivery URL, from POST /media/upload' })
  @IsOptional() @IsString() @Length(0, 2000)
  photoUrl?: string;
}
