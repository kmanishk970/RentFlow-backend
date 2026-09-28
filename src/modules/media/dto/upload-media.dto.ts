import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

/**
 * Where an upload is filed.
 *
 * Not free text: the folder decides which types and sizes are accepted, so a
 * caller naming their own would be choosing their own limits.
 */
export enum MediaFolder {
  Documents = 'documents',
  Photos = 'photos',
}

export class UploadMediaDto {
  @ApiPropertyOptional({ enum: MediaFolder, default: MediaFolder.Documents })
  @IsOptional()
  @IsEnum(MediaFolder, { message: 'folder must be documents or photos' })
  folder?: MediaFolder;
}

export class DeleteMediaDto {
  @ApiProperty({ example: 'rentflow/<owner>/documents/agreement_a1b2c3' })
  @IsString()
  @Length(1, 400)
  publicId: string;

  @ApiPropertyOptional({ example: 'raw', default: 'image' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  resourceType?: string;
}
