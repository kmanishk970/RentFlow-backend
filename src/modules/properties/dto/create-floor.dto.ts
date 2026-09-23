import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFloorDto {
  @ApiProperty({ example: 0, description: '0 is the ground floor' })
  @Type(() => Number)
  @IsInt({ message: 'Floor level must be a whole number' })
  @Min(-5) @Max(200)
  level: number;

  @ApiProperty({ example: 'Ground Floor' })
  @IsString() @Length(2, 60)
  name: string;
}
