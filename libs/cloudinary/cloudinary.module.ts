import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { ConfigModule } from '@nestjs/config';
import { CloudinaryProvider } from './cloudinary.provider';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { BullModule } from '@nestjs/bull';
import { QueueName } from '@app/common/enums/queue/queue-name.enum';
import { CloudinaryProcessor } from './cloudinary.processor';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: QueueName.CLOUDINARY,
    }),
  ],
  providers: [CloudinaryService, CloudinaryProvider, CustomLogger, CloudinaryProcessor],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
