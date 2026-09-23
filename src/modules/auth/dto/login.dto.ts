import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty({ example: 'owner@rentflow.test' })
  @IsEmail({}, { message: 'Enter a valid email address' })
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email: string;

  @ApiProperty({ example: 'rentflow-dev-1' })
  @IsString()
  @Length(1, 72)
  password: string;
}
