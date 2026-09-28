import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  v2 as cloudinary,
  type UploadApiOptions,
  type UploadApiResponse,
} from 'cloudinary';

import { MediaFolder } from './dto/upload-media.dto';

/** What an upload gives back, and what the caller stores against a row. */
export interface UploadedMedia {
  /** The delivery URL. This is what goes in the database. */
  url: string;
  /** Cloudinary's handle for the asset — needed to delete it later. */
  publicId: string;
  /** 'image' or 'raw'; both are needed to address the asset again. */
  resourceType: string;
  format: string | null;
  bytes: number;
  originalName: string;
  mimeType: string;
  width?: number;
  height?: number;
}

/**
 * Per-folder rules, so a profile photo cannot be a 20 MB scan.
 *
 * Images only, documents included — an agreement is photographed or scanned
 * rather than attached as a PDF. PDFs are not merely unsupported here: the
 * Cloudinary account restricts their delivery by extension, so one would
 * upload and store cleanly and then answer every attempt to open it with a
 * 401. Refusing at the door beats a record that only looks saved.
 */
const RULES: Record<MediaFolder, { types: readonly string[]; maxBytes: number }> = {
  [MediaFolder.Documents]: {
    types: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: 20 * 1024 * 1024,
  },
  [MediaFolder.Photos]: {
    types: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: 5 * 1024 * 1024,
  },
};

/** Bytes over this never reach Cloudinary, whatever the folder asks for. */
export const MAX_UPLOAD_BYTES = Math.max(
  ...Object.values(RULES).map((rule) => rule.maxBytes),
);

function megabytes(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

/**
 * Uploads to Cloudinary.
 *
 * The bytes pass through the API rather than going straight from the browser,
 * which costs a hop but means the credentials stay on the server and every
 * upload is already behind the JWT guard — an unsigned browser preset is open
 * to anyone who reads the page source.
 *
 * Only two things are ever stored from the response: the delivery URL, which
 * is what a page renders, and the public id, which is what a delete needs.
 */
@Injectable()
export class MediaService implements OnModuleInit {
  private readonly log = new Logger(MediaService.name);
  private readonly root: string;
  private configured = false;

  constructor(private readonly config: ConfigService) {
    this.root = this.config.get<string>('cloudinary.folder') ?? 'rentflow';
  }

  onModuleInit() {
    const credential = this.credential();

    if (!credential) {
      // Not fatal: every other endpoint works without storage, and a developer
      // running the app for the first time should not be blocked by an account
      // they have not signed up for yet. Uploading says so plainly.
      this.log.warn(
        'CLOUDINARY_URL (or the three CLOUDINARY_* values) is not set — ' +
          'uploads will be refused until it is',
      );
      return;
    }

    cloudinary.config({ ...credential, secure: true });
    this.configured = true;

    // A wrong pair is otherwise only discovered by a person trying to upload,
    // who is told "cloud_name mismatch" and nothing about where it came from.
    void cloudinary.api
      .ping()
      .catch((error: { error?: { message?: string } }) =>
        this.log.error(
          `Cloudinary refused these credentials: ${
            error?.error?.message ?? 'unknown error'
          }. Uploads will fail until they are fixed.`,
        ),
      );
  }

  /**
   * The credential, from whichever form it was given in.
   *
   * CLOUDINARY_URL is one string straight from the console and wins when set:
   * the three separate values are easy to copy from two different product
   * environments, and the only symptom is a 401 at upload time.
   */
  private credential():
    | { cloud_name: string; api_key: string; api_secret: string }
    | null {
    const url = this.config.get<string>('cloudinary.url');

    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.username && parsed.password && parsed.hostname) {
          return {
            cloud_name: parsed.hostname,
            api_key: decodeURIComponent(parsed.username),
            api_secret: decodeURIComponent(parsed.password),
          };
        }
        this.log.warn('CLOUDINARY_URL is missing a key, secret or cloud name');
      } catch {
        this.log.warn(
          'CLOUDINARY_URL is not a URL — expected cloudinary://<key>:<secret>@<cloud>',
        );
      }
    }

    const cloudName = this.config.get<string>('cloudinary.cloudName');
    const apiKey = this.config.get<string>('cloudinary.apiKey');
    const apiSecret = this.config.get<string>('cloudinary.apiSecret');

    if (!cloudName || !apiKey || !apiSecret) return null;
    return { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret };
  }

  /**
   * Sends one file up and returns what to save.
   *
   * Images go up as `image`, so Cloudinary can transform and optimise them.
   * The `raw` branch is what anything else would take — nothing reaches it
   * while RULES accepts images only, and it is what a later file type would
   * need, so it stays.
   */
  async upload(
    file: Express.Multer.File,
    folder: MediaFolder,
    ownerId: string,
  ): Promise<UploadedMedia> {
    if (!this.configured) {
      throw new InternalServerErrorException(
        'File storage is not configured on this server',
      );
    }
    if (!file) throw new BadRequestException('No file was sent');

    const rule = RULES[folder];
    if (!rule.types.includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException(
        `${file.mimetype} is not accepted here — allowed: ${rule.types.join(', ')}`,
      );
    }
    if (file.size > rule.maxBytes) {
      throw new PayloadTooLargeException(
        `That file is ${megabytes(file.size)} — the limit is ${megabytes(rule.maxBytes)}`,
      );
    }
    if (file.size === 0) throw new BadRequestException('That file is empty');

    const options: UploadApiOptions = {
      // One folder per owner, so nothing in the account is shared between two
      // landlords even by accident.
      folder: `${this.root}/${ownerId}/${folder}`,
      resource_type: file.mimetype.startsWith('image/') ? 'image' : 'raw',
      // Keeps a recognisable name in the URL without letting two files with
      // the same name collide.
      use_filename: true,
      unique_filename: true,
      filename_override: file.originalname,
      overwrite: false,
    };

    const result = await this.send(file.buffer, options);

    return {
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
      format: result.format ?? null,
      bytes: result.bytes,
      originalName: file.originalname,
      mimeType: file.mimetype,
      ...(result.width ? { width: result.width } : {}),
      ...(result.height ? { height: result.height } : {}),
    };
  }

  /**
   * Whether an asset sits in this owner's own folder.
   *
   * Every upload is filed under the owner's id, so the prefix is the check: it
   * stops a signed-in landlord from deleting a public id belonging to another.
   */
  owns(publicId: string, ownerId: string): boolean {
    return publicId.startsWith(`${this.root}/${ownerId}/`);
  }

  /**
   * Removes an asset.
   *
   * Never throws: this runs while deleting the row that pointed at the file,
   * and a storage hiccup should not leave the record behind. A leftover object
   * is a smaller problem than a document that cannot be deleted.
   */
  async destroy(publicId: string, resourceType = 'image'): Promise<boolean> {
    if (!this.configured || !publicId) return false;

    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      });
      return result.result === 'ok';
    } catch (error) {
      this.log.warn(`Could not delete ${publicId}: ${String(error)}`);
      return false;
    }
  }

  /** The SDK's stream upload, as a promise. */
  private send(buffer: Buffer, options: UploadApiOptions): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error || !result) {
          this.log.error(`Upload failed: ${error?.message ?? 'no result'}`);
          reject(
            new InternalServerErrorException(
              'The file could not be uploaded. Try again.',
            ),
          );
          return;
        }
        resolve(result);
      });
      stream.end(buffer);
    });
  }
}
