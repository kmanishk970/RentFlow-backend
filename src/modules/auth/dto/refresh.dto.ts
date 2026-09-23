import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ description: 'The refresh token issued at login' })
  @IsJWT({ message: 'That is not a valid token' })
  refreshToken: string;
}
