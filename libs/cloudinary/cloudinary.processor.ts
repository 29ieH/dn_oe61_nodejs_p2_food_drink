import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { DeleteImagePayload } from './payload/cloudinary.payload';
import { QueueName } from '@app/common/enums/queue/queue-name.enum';
import { CloudinaryEvent } from '@app/common/enums/queue/cloudinary-event.enum';
@Processor(QueueName.CLOUDINARY)
@Injectable()
export class CloudinaryProcessor {
  constructor(private readonly cloudinaryService: CloudinaryService) {}
  @Process({ name: CloudinaryEvent.DELETE_IMAGE, concurrency: 10 })
  async handleDeleteImage(job: Job<DeleteImagePayload>) {
    const { publicId } = job.data;
    return await this.cloudinaryService.deleteImage(publicId);
  }
}
