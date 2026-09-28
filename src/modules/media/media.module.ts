import { Module } from '@nestjs/common';

import { MediaController } from './media.controller';
import { MediaService } from './media.service';

/** Uploads. Exported because deleting a row deletes its file too. */
@Module({
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
