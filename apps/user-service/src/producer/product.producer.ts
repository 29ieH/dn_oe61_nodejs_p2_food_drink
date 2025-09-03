import { DeleteSoftCartRequest } from '@app/common/dto/product/requests/delete-soft-cart.request';
import { ProductEvent } from '@app/common/enums/queue/product-event.enum';
import { QueueName } from '@app/common/enums/queue/queue-name.enum';
import { addJobWithRetry } from '@app/common/helpers/queue.helper';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';

@Injectable()
export class ProductProducer {
  constructor(
    @InjectQueue(QueueName.PRODUCT) private readonly productQueue: Queue,
    private readonly loggerService: CustomLogger,
  ) {}
  async addJobSoftDeleteCart(payload: DeleteSoftCartRequest) {
    try {
      await addJobWithRetry(this.productQueue, ProductEvent.SOFT_DELETE_CART, payload);
    } catch (error) {
      this.loggerService.error(
        `[Add job soft delete cart failed]`,
        `Details:: ${(error as Error).stack}`,
      );
      throw error;
    }
  }
}
