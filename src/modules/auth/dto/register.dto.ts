import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @ApiProperty({ example: 'rajesh@kapoorproperties.in' })
  @IsEmail({}, { message: 'Enter a valid email address' })
  // Stored lowercased; a check constraint in the database holds it to that.
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email: string;

  @ApiProperty({ example: 'a-long-passphrase-1', minLength: 8 })
  @IsString()
  @Length(8, 72, { message: 'Use between 8 and 72 characters' })
  @Matches(/[0-9]/, { message: 'Include at least one number' })
  @Matches(/\p{L}/u, { message: 'Include at least one letter' })
  password: string;

  @ApiProperty({ example: 'Rajesh Kapoor' })
  @IsString()
  @Length(2, 80)
  name: string;

  @ApiProperty({ required: false, example: '+91 98765 00000' })
  @IsOptional()
  @IsString()
  @Length(8, 20)
  phone?: string;

  @ApiProperty({ required: false, example: 'Kapoor Properties' })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  company?: string;
}
