import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { MAX_UPLOAD_BYTES, MediaService } from './media.service';
import { DeleteMediaDto, MediaFolder, UploadMediaDto } from './dto/upload-media.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('upload')
  @ApiOperation({
    summary: 'Upload one file and get back the URL to store',
    description:
      'The caller saves the returned url (and publicId) on whatever row the ' +
      'file belongs to — a document, a person, the owner profile.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        folder: { type: 'string', enum: Object.values(MediaFolder) },
      },
    },
  })
  @UseInterceptors(
    // Memory, not disk: the buffer goes straight up to Cloudinary, and a
    // container filesystem is not somewhere to leave tenant paperwork. The
    // limit here is a floor under the per-folder rules in the service — it
    // stops an oversized body before it is fully read.
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }),
  )
  upload(
    @CurrentUser('ownerId') ownerId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadMediaDto,
  ) {
    return this.media.upload(file, dto.folder ?? MediaFolder.Documents, ownerId);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete an uploaded file',
    description:
      'For a file picked but never saved against a row. Deleting a document ' +
      'row already removes its file.',
  })
  async remove(
    @CurrentUser('ownerId') ownerId: string,
    @Body() dto: DeleteMediaDto,
  ) {
    // A public id is guessable; knowing one does not imply owning it.
    if (!this.media.owns(dto.publicId, ownerId)) {
      throw new ForbiddenException('That file belongs to another account');
    }

    const deleted = await this.media.destroy(dto.publicId, dto.resourceType);
    return { publicId: dto.publicId, deleted };
  }
}
