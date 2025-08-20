import { CartItemResponse } from './cart-item-response';

export class CartSummaryResponse {
  cartId: number;
  userId: number;
  cartItems: CartItemResponse[];
  totalQuantity: number;
  totalAmount: number;
}
