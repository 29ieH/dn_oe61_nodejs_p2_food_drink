import { Controller } from '@nestjs/common';
import { ProductService } from './product-service.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProductPattern } from '@app/common/enums/message-patterns/product.pattern';
import { CreateProductDto } from '@app/common/dto/product/create-product.dto';
import { ProductResponse } from '@app/common/dto/product/response/product-response';
import { AddProductCartRequest } from '@app/common/dto/product/requests/add-product-cart.request';
import { CartSummaryResponse } from '@app/common/dto/product/response/cart-summary.response';
import { BaseResponse } from '@app/common/interfaces/data-type';
import { DeleteProductCartRequest } from '@app/common/dto/product/requests/delete-product-cart.request';

@Controller()
export class ProductServiceController {
  constructor(private readonly productService: ProductService) {}

  @MessagePattern(ProductPattern.CHECK_PRODUCT_EXISTS)
  async checkProductExists(@Payload() skuId: string) {
    return await this.productService.checkProductExists(skuId);
  }

  @MessagePattern(ProductPattern.CREATE_PRODUCT)
  async createProduct(@Payload() payLoad: CreateProductDto): Promise<ProductResponse | null> {
    return await this.productService.createProduct(payLoad);
  }

  @MessagePattern(ProductPattern.ADD_PRODUCT_CART)
  async addProductCart(
    @Payload() payLoad: AddProductCartRequest,
  ): Promise<BaseResponse<CartSummaryResponse>> {
    return await this.productService.addProductCart(payLoad);
  }
  @MessagePattern(ProductPattern.DELETE_PRODUCT_CART)
  async deleteProductCart(
    @Payload() payLoad: DeleteProductCartRequest,
  ): Promise<BaseResponse<CartSummaryResponse>> {
    return await this.productService.deleteProductCart(payLoad);
  }
}
