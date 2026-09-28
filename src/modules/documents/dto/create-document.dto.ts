import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum, IsInt, IsOptional, IsString, IsUrl, IsUUID, Length, Max, Min,
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

  @ApiProperty({ description: "Cloudinary's public id, from POST /media/upload" })
  @IsString() @Length(1, 400)
  storageKey: string;

  @ApiPropertyOptional({ description: 'Delivery URL, from POST /media/upload' })
  @IsOptional() @IsUrl({ require_tld: false }, { message: 'url must be a URL' })
  @Length(1, 2000)
  url?: string;

  @ApiPropertyOptional({ example: 'raw', description: "image or raw, as the upload returned" })
  @IsOptional() @IsString() @Length(1, 20)
  resourceType?: string;

  @ApiPropertyOptional({ description: "The back of an ID card: Cloudinary public id" })
  @IsOptional() @IsString() @Length(1, 400)
  backStorageKey?: string;

  @ApiPropertyOptional({ description: 'The back of an ID card: delivery URL' })
  @IsOptional() @IsUrl({ require_tld: false }, { message: 'backUrl must be a URL' })
  @Length(1, 2000)
  backUrl?: string;

  @ApiPropertyOptional({ example: 'image' })
  @IsOptional() @IsString() @Length(1, 20)
  backResourceType?: string;

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
