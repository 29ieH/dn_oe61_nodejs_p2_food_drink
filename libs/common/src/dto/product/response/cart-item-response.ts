export class CartItemResponse {
  id: number;
  quantity: number;
  productVariant: {
    id: number;
    price: number;
  };
}
