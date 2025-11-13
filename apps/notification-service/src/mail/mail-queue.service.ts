import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { MailJobDataDto } from '@app/common/dto/mail.dto';

@Injectable()
export class MailQueueService {
  constructor(
    @InjectQueue('mailQueue') private mailQueue: Queue,
    private readonly logger: Logger
  ) { }

  async enqueueMailJob(jobName: string, data: MailJobDataDto) {
    if (!jobName) {
      this.logger.warn(`Missing required jobName`);
      return;
    }

    try {
      await this.mailQueue.add(jobName, data, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });
    } catch (error) {
      this.logger.error(
        `Failed to add mail job '${jobName}' for recipient: ${data.to}`,
        error.stack,
      );
      throw error;
    }
  }
}
