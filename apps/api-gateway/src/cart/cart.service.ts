import { PRODUCT_SERVICE } from '@app/common';
import { RETRIES_DEFAULT, TIMEOUT_MS_DEFAULT } from '@app/common/constant/rpc.constants';
import { AddProductCartRequest } from '@app/common/dto/product/requests/add-product-cart.request';
import { DeleteProductCartRequest } from '@app/common/dto/product/requests/delete-product-cart.request';
import { CartSummaryResponse } from '@app/common/dto/product/response/cart-summary.response';
import { HTTP_ERROR_CODE } from '@app/common/enums/errors/http-error-code';
import { ProductPattern } from '@app/common/enums/message-patterns/product.pattern';
import { TypedRpcException } from '@app/common/exceptions/rpc-exceptions';
import { callMicroservice } from '@app/common/helpers/microservices';
import { BaseResponse } from '@app/common/interfaces/data-type';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class CartService {
  constructor(
    @Inject(PRODUCT_SERVICE) private readonly productClient: ClientProxy,
    private readonly loggerService: CustomLogger,
  ) {}
  async addProductCart(payload: AddProductCartRequest) {
    if (!payload.userId)
      throw new TypedRpcException({
        code: HTTP_ERROR_CODE.UNAUTHORIZED,
        message: 'common.error.unauthorized',
      });
    return await callMicroservice<BaseResponse<CartSummaryResponse>>(
      this.productClient.send(ProductPattern.ADD_PRODUCT_CART, payload),
      PRODUCT_SERVICE,
      this.loggerService,
      {
        timeoutMs: TIMEOUT_MS_DEFAULT,
        retries: RETRIES_DEFAULT,
      },
    );
  }
  async deleteProductCart(payload: DeleteProductCartRequest) {
    if (!payload.userId)
      throw new TypedRpcException({
        code: HTTP_ERROR_CODE.UNAUTHORIZED,
        message: 'common.errors.unauthorized',
      });
    return await callMicroservice<BaseResponse<CartSummaryResponse>>(
      this.productClient.send(ProductPattern.DELETE_PRODUCT_CART, payload),
      PRODUCT_SERVICE,
      this.loggerService,
      {
        timeoutMs: TIMEOUT_MS_DEFAULT,
        retries: RETRIES_DEFAULT,
      },
    );
  }
}
