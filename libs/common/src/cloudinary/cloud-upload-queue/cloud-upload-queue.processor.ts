import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { Readable } from 'stream';
import { CloudinaryService } from '../cloudinary.service';
import { Process, Processor } from '@nestjs/bull';

export interface CloudUploadJobData {
  bufferBase64: string;
  originalname: string;
  mimetype: string;
  folder: string;
}

@Processor('cloudUploadQueue')
export class CloudUploadQueueProcessor {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly logger: Logger,
  ) {}
  @Process('cloudinaryUpload')
  async handleUpload(job: Job<CloudUploadJobData>) {
    this.logger.log(`Processing cloud upload job id=${job.id}`);
    const { bufferBase64, originalname, mimetype, folder } = job.data;
    const file: Express.Multer.File = {
      fieldname: 'file',
      buffer: Buffer.from(bufferBase64, 'base64'),
      originalname,
      mimetype,
      size: Buffer.byteLength(bufferBase64, 'base64'),
      encoding: '7bit',
      destination: '',
      filename: originalname,
      path: '',
      stream: Readable.from(Buffer.from(bufferBase64, 'base64')),
    };

    try {
      this.logger.log(`Starting upload for ${originalname}`);
      const result = await this.cloudinaryService.upload(file, folder);
      this.logger.log(`Upload completed for ${originalname}: ${result.secure_url}`);
      return result.secure_url;
    } catch (error) {
      this.logger.error(`Upload failed for ${originalname}:`, error);
      throw error;
    }
  }
}
