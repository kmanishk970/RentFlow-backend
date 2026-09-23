import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min,
} from 'class-validator';
import { DocumentKind } from '../../../common/domain.enums';

/** 20 MB, matching what the frontend picker accepts. */
const MAX_BYTES = 20 * 1024 * 1024;

export class CreateDocumentDto {
  @ApiProperty({ enum: DocumentKind })
  @IsEnum(DocumentKind, { message: 'Pick a document type' })
  kind: DocumentKind;

  @ApiProperty({ example: 'Rental Agreement - Arjun Mehta' })
  @IsString() @Length(3, 120)
  title: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID('4')
  propertyId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID('4')
  leaseId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID('4')
  personId?: string;

  @ApiProperty({ description: 'Where the bytes live in object storage' })
  @IsString() @Length(1, 400)
  storageKey: string;

  @ApiProperty({ example: 'agreement.pdf' })
  @IsString() @Length(1, 260)
  originalName: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString() @Length(3, 120)
  mimeType: string;

  @ApiProperty({ example: 248310 })
  @Type(() => Number)
  @IsInt({ message: 'Size must be a whole number of bytes' })
  @Min(1, { message: 'An empty file cannot be recorded' })
  @Max(MAX_BYTES, { message: 'Files are limited to 20 MB' })
  sizeBytes: number;
}
