import { DeleteSoftCartRequest } from '@app/common/dto/product/requests/delete-soft-cart.request';
import { ProductEvent } from '@app/common/enums/queue/product-event.enum';
import { QueueName } from '@app/common/enums/queue/queue-name.enum';
import { Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { ProductService } from './product-service.service';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { isRpcError } from '@app/common/utils/error.util';
import { HTTP_ERROR_CODE } from '@app/common/enums/errors/http-error-code';

@Processor({ name: QueueName.PRODUCT })
@Injectable()
export class ProductProcessor {
  constructor(
    private readonly productService: ProductService,
    private readonly loggerService: CustomLogger,
  ) {}
  @Process(ProductEvent.SOFT_DELETE_CART)
  async handleNewProduct(job: Job<DeleteSoftCartRequest>) {
    try {
      await this.productService.deleteSoftCart(job.data);
    } catch (error) {
      const rpcError = isRpcError(error);
      if (rpcError) {
        if (error.code == HTTP_ERROR_CODE.CONFLICT) {
          this.loggerService.error(
            `[Error delete soft cart]`,
            `Details:: Error by prisma client - cancelled retry`,
          );
          await job.discard();
          return;
        }
        throw error;
      }
    }
  }
}
