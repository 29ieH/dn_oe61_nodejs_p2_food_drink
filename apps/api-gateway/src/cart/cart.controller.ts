import { CurrentUser } from '@app/common';
import { AddProductCartRequest } from '@app/common/dto/product/requests/add-product-cart.request';
import { AddProductPayload } from '@app/common/dto/product/requests/add-product-payload';
import { DeleteProductCartPayload } from '@app/common/dto/product/requests/delete-product-cart-payload';
import { DeleteProductCartRequest } from '@app/common/dto/product/requests/delete-product-cart.request';
import { AccessTokenPayload } from '@app/common/interfaces/token-payload';
import { Body, Controller, Delete, Post } from '@nestjs/common';
import { CartService } from './cart.service';

@Controller('carts')
export class CartController {
  constructor(private readonly cartService: CartService) {}
  @Post('items')
  async addProductCart(
    @CurrentUser() user: AccessTokenPayload,
    @Body() payload: AddProductPayload,
  ) {
    const dto: AddProductCartRequest = {
      userId: user.id,
      ...payload,
    };
    return this.cartService.addProductCart(dto);
  }
  @Delete('/items')
  async deleteProductCart(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: DeleteProductCartPayload,
  ) {
    const payload: DeleteProductCartRequest = {
      userId: user.id,
      productVariantIds: dto.productVariantIds,
    };
    return this.cartService.deleteProductCart(payload);
  }
}
