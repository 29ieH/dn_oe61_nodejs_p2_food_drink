import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { MailerService } from '@nestjs-modules/mailer';
import { Logger } from '@nestjs/common';
import { MailJobDataDto } from '@app/common/dto/mail.dto';

@Processor('mailQueue')
export class MailQueueProcessor {
  constructor(
    private readonly mailerService: MailerService,
    private readonly logger: Logger,
  ) {}

  @Process('sendReminderEmail')
  async handleReminderEmail(job: Job<MailJobDataDto>) {
    const { to, subject, template, context } = job.data;

    if (!to || !subject || !template) {
      this.logger.warn(`Missing required email fields`);
      return;
    }

    try {
      await this.mailerService.sendMail({ to, subject, template, context });
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to}`,
        error instanceof Error ? error.stack : 'Unknown error',
        'MailQueueProcessor.handleReminderEmail',
      );
    }
  }
}
