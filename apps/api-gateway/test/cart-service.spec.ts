jest.mock('@app/common/helpers/microservices', () => ({
  callMicroservice: jest.fn(),
}));

jest.mock('@app/common/utils/data.util', () => ({
  buildBaseResponse: jest.fn(),
}));

import { PRODUCT_SERVICE } from '@app/common';
import { RETRIES_DEFAULT, TIMEOUT_MS_DEFAULT } from '@app/common/constant/rpc.constants';
import { CartSummaryResponse } from '@app/common/dto/product/response/cart-summary.response';
import { HTTP_ERROR_CODE } from '@app/common/enums/errors/http-error-code';
import { ProductPattern } from '@app/common/enums/message-patterns/product.pattern';
import { StatusKey } from '@app/common/enums/status-key.enum';
import { TypedRpcException } from '@app/common/exceptions/rpc-exceptions';
import { callMicroservice } from '@app/common/helpers/microservices';
import { BaseResponse } from '@app/common/interfaces/data-type';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { CartService } from '../src/cart/cart.service';

describe('CartService', () => {
  let service: CartService;
  let moduleRef: TestingModule;

  const mockCartClient = {
    send: jest.fn(),
  };

  const mockLoggerService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const mockI18nService = {
    translate: jest.fn(),
  };
  const mockCallMicroservice = callMicroservice as jest.MockedFunction<typeof callMicroservice>;
  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        CartService,
        {
          provide: PRODUCT_SERVICE,
          useValue: mockCartClient,
        },
        {
          provide: CustomLogger,
          useValue: mockLoggerService,
        },
        {
          provide: I18nService,
          useValue: mockI18nService,
        },
      ],
    }).compile();

    service = moduleRef.get<CartService>(CartService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe('addProductCart', () => {
    const mockAddProductCartRequest = {
      userId: 123,
      productVariantId: 10,
      quantity: 2,
    };

    const mockCartSummaryResponse = {
      cartId: 1,
      userId: 123,
      cartItems: [
        {
          id: 1,
          quantity: 2,
          productVariant: {
            id: 10,
            price: 29.99,
          },
        },
      ],
      totalQuantity: 2,
      totalAmount: 59.98,
    };

    const mockSuccessCartResponse: BaseResponse<CartSummaryResponse> = {
      statusKey: StatusKey.SUCCESS,
      data: mockCartSummaryResponse,
    };

    beforeEach(() => {
      mockI18nService.translate.mockImplementation((key: string) => key);
    });

    it('should add product to cart successfully with valid userId', async () => {
      mockCallMicroservice.mockResolvedValueOnce(mockSuccessCartResponse);
      const result = await service.addProductCart(mockAddProductCartRequest);

      expect(mockCallMicroservice).toHaveBeenCalledWith(
        mockCartClient.send(ProductPattern.ADD_PRODUCT_CART, mockAddProductCartRequest),
        PRODUCT_SERVICE,
        mockLoggerService,
        {
          timeoutMs: TIMEOUT_MS_DEFAULT,
          retries: RETRIES_DEFAULT,
        },
      );

      expect(mockCallMicroservice).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockSuccessCartResponse);
    });

    it('should throw TypedRpcException when userId is undefined', async () => {
      const requestWithoutUserId = {
        userId: undefined as unknown as number,
        productVariantId: 10,
        quantity: 2,
      };
      await expect(service.addProductCart(requestWithoutUserId)).rejects.toThrow();
      expect(mockCallMicroservice).not.toHaveBeenCalled();
    });
    it('should throw TypedRpcException when userId is null', async () => {
      const requestWithNullUserId = {
        userId: null as unknown as number,
        productVariantId: 10,
        quantity: 2,
      };

      await expect(service.addProductCart(requestWithNullUserId)).rejects.toThrow();
      expect(mockCallMicroservice).not.toHaveBeenCalled();
    });
    it('should handle microservice returning quantity not enough error', async () => {
      const rpcError = {
        code: HTTP_ERROR_CODE.BAD_REQUEST,
        message: 'common.product.quantityNotEnough',
      };
      mockCallMicroservice.mockRejectedValueOnce(new TypedRpcException(rpcError));
      try {
        await service.addProductCart(mockAddProductCartRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).message).toEqual(rpcError.message);
      }
      expect(mockCallMicroservice).toHaveBeenCalledWith(
        mockCartClient.send(ProductPattern.ADD_PRODUCT_CART, mockAddProductCartRequest),
        PRODUCT_SERVICE,
        mockLoggerService,
        {
          timeoutMs: TIMEOUT_MS_DEFAULT,
          retries: RETRIES_DEFAULT,
        },
      );
    });
    it('should handle microservice returning product not found error', async () => {
      const rpcError = {
        code: HTTP_ERROR_CODE.NOT_FOUND,
        message: 'common.product.notFound',
      };
      mockCallMicroservice.mockRejectedValueOnce(new TypedRpcException(rpcError));
      try {
        await service.addProductCart(mockAddProductCartRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
      }
      expect(mockCallMicroservice).toHaveBeenCalledWith(
        mockCartClient.send('add-product-cart', mockAddProductCartRequest),
        PRODUCT_SERVICE,
        mockLoggerService,
        {
          timeoutMs: TIMEOUT_MS_DEFAULT,
          retries: RETRIES_DEFAULT,
        },
      );
    });
    it('should handle microservice connection timeout', async () => {
      const rpcError = {
        code: HTTP_ERROR_CODE.SERVICE_UNAVAILABLE,
        message: 'common.errors.serviceUnavailable',
      };
      mockCallMicroservice.mockRejectedValueOnce(new TypedRpcException(rpcError));
      try {
        await service.addProductCart(mockAddProductCartRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).message).toEqual(rpcError.message);
      }
      expect(mockCallMicroservice).toHaveBeenCalledWith(
        mockCartClient.send('add-product-cart', mockAddProductCartRequest),
        PRODUCT_SERVICE,
        mockLoggerService,
        {
          timeoutMs: TIMEOUT_MS_DEFAULT,
          retries: RETRIES_DEFAULT,
        },
      );
      expect(mockCallMicroservice).toHaveBeenCalledTimes(1);
    });
    it('should handle adding multiple quantities to cart', async () => {
      const multipleQuantityRequest = {
        userId: 123,
        productVariantId: 10,
        quantity: 5,
      };
      const multipleQuantityResponse = {
        ...mockSuccessCartResponse,
        data: {
          ...mockCartSummaryResponse,
          cartItems: [
            {
              id: 1,
              quantity: 5,
              productVariant: {
                id: 10,
                price: 29.99,
              },
            },
          ],
          totalQuantity: 5,
          totalAmount: 149.95,
        },
      };

      mockCallMicroservice.mockResolvedValueOnce(multipleQuantityResponse);

      const result: BaseResponse<CartSummaryResponse> =
        await service.addProductCart(multipleQuantityRequest);

      expect(mockCallMicroservice).toHaveBeenCalledWith(
        mockCartClient.send('add-product-cart', multipleQuantityRequest),
        PRODUCT_SERVICE,
        mockLoggerService,
        {
          timeoutMs: TIMEOUT_MS_DEFAULT,
          retries: RETRIES_DEFAULT,
        },
      );

      expect(result.data?.totalQuantity).toBe(5);
      expect(result.data?.totalAmount).toBe(149.95);
    });
    it('should handle adding product to existing cart with items', async () => {
      const existingCartResponse = {
        ...mockSuccessCartResponse,
        data: {
          ...mockCartSummaryResponse,
          cartItems: [
            {
              id: 1,
              quantity: 3,
              productVariant: {
                id: 5,
                price: 19.99,
              },
            },
            {
              id: 2,
              quantity: 2,
              productVariant: {
                id: 10,
                price: 29.99,
              },
            },
          ],
          totalQuantity: 5,
          totalAmount: 119.95,
        },
      };

      mockCallMicroservice.mockResolvedValueOnce(existingCartResponse);

      const result = await service.addProductCart(mockAddProductCartRequest);

      expect(mockCallMicroservice).toHaveBeenCalledWith(
        mockCartClient.send('add-product-cart', mockAddProductCartRequest),
        PRODUCT_SERVICE,
        mockLoggerService,
        {
          timeoutMs: TIMEOUT_MS_DEFAULT,
          retries: RETRIES_DEFAULT,
        },
      );

      expect(result.data?.cartItems).toHaveLength(2);
      expect(result.data?.totalQuantity).toBe(5);
    });
    it('should handle edge case with maximum quantity', async () => {
      const maxQuantityRequest = {
        userId: 123,
        productVariantId: 10,
        quantity: 999,
      };

      const maxQuantityResponse = {
        ...mockSuccessCartResponse,
        data: {
          ...mockCartSummaryResponse,
          cartItems: [
            {
              id: 1,
              quantity: 999,
              productVariant: {
                id: 10,
                price: 29.99,
              },
            },
          ],
          totalQuantity: 999,
          totalAmount: 29960.01,
        },
      };

      mockCallMicroservice.mockResolvedValueOnce(maxQuantityResponse);

      const result: BaseResponse<CartSummaryResponse> =
        await service.addProductCart(maxQuantityRequest);

      expect(mockCallMicroservice).toHaveBeenCalledWith(
        mockCartClient.send('add-product-cart', maxQuantityRequest),
        PRODUCT_SERVICE,
        mockLoggerService,
        {
          timeoutMs: TIMEOUT_MS_DEFAULT,
          retries: RETRIES_DEFAULT,
        },
      );

      expect(result.data?.totalQuantity).toBe(999);
    });
    it('should handle negative quantity gracefully', async () => {
      const negativeQuantityRequest = {
        userId: 123,
        productVariantId: 10,
        quantity: -1,
      };

      const validationError = new Error('Invalid quantity');
      mockCallMicroservice.mockRejectedValueOnce(validationError);

      await expect(service.addProductCart(negativeQuantityRequest)).rejects.toThrow(
        validationError,
      );

      expect(mockCallMicroservice).toHaveBeenCalledWith(
        mockCartClient.send('add-product-cart', negativeQuantityRequest),
        PRODUCT_SERVICE,
        mockLoggerService,
        {
          timeoutMs: TIMEOUT_MS_DEFAULT,
          retries: RETRIES_DEFAULT,
        },
      );
    });
    it('should handle zero quantity', async () => {
      const zeroQuantityRequest = {
        userId: 123,
        productVariantId: 10,
        quantity: 0,
      };
      const rpcError = {
        code: HTTP_ERROR_CODE.BAD_REQUEST,
        message: 'common.validation.min',
      };
      mockCallMicroservice.mockRejectedValueOnce(new TypedRpcException(rpcError));
      try {
        await service.addProductCart(zeroQuantityRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).message).toEqual(rpcError.message);
      }
      expect(mockCallMicroservice).toHaveBeenCalledWith(
        mockCartClient.send('add-product-cart', zeroQuantityRequest),
        PRODUCT_SERVICE,
        mockLoggerService,
        {
          timeoutMs: TIMEOUT_MS_DEFAULT,
          retries: RETRIES_DEFAULT,
        },
      );
    });
    it('should handle microservice returning null response', async () => {
      mockCallMicroservice.mockResolvedValueOnce(null);

      const result = await service.addProductCart(mockAddProductCartRequest);

      expect(mockCallMicroservice).toHaveBeenCalledWith(
        mockCartClient.send('add-product-cart', mockAddProductCartRequest),
        PRODUCT_SERVICE,
        mockLoggerService,
        {
          timeoutMs: TIMEOUT_MS_DEFAULT,
          retries: RETRIES_DEFAULT,
        },
      );

      expect(result).toBeNull();
    });

    it('should handle microservice returning empty cart response', async () => {
      const emptyCartResponse = {
        statusKey: StatusKey.SUCCESS,
        data: {
          cartId: 1,
          userId: 123,
          cartItems: [],
          totalQuantity: 0,
          totalAmount: 0,
        },
      };

      mockCallMicroservice.mockResolvedValueOnce(emptyCartResponse);

      const result = await service.addProductCart(mockAddProductCartRequest);

      expect(mockCallMicroservice).toHaveBeenCalledWith(
        mockCartClient.send('add-product-cart', mockAddProductCartRequest),
        PRODUCT_SERVICE,
        mockLoggerService,
        {
          timeoutMs: TIMEOUT_MS_DEFAULT,
          retries: RETRIES_DEFAULT,
        },
      );

      expect(result.data?.cartItems).toHaveLength(0);
      expect(result.data?.totalQuantity).toBe(0);
      expect(result.data?.totalAmount).toBe(0);
    });

    it('should validate userId is truthy before making microservice call', async () => {
      const falsyUserIds = [undefined, null, 0, false, '', NaN];
      for (const falsyUserId of falsyUserIds) {
        const requestWithFalsyUserId = {
          userId: falsyUserId as unknown as number,
          productVariantId: 10,
          quantity: 2,
        };

        await expect(service.addProductCart(requestWithFalsyUserId)).rejects.toThrow();
      }
      expect(mockCallMicroservice).not.toHaveBeenCalled();
    });

    it('should handle concurrent cart additions', async () => {
      const request1 = { userId: 123, productVariantId: 10, quantity: 1 };
      const request2 = { userId: 123, productVariantId: 11, quantity: 2 };

      const response1 = {
        ...mockSuccessCartResponse,
        data: { ...mockCartSummaryResponse, totalQuantity: 1 },
      };
      const response2 = {
        ...mockSuccessCartResponse,
        data: { ...mockCartSummaryResponse, totalQuantity: 3 },
      };

      mockCallMicroservice.mockResolvedValueOnce(response1).mockResolvedValueOnce(response2);
      const [result1, result2] = await Promise.all([
        service.addProductCart(request1),
        service.addProductCart(request2),
      ]);

      expect(mockCallMicroservice).toHaveBeenCalledTimes(2);
      expect(result1.data?.totalQuantity).toBe(1);
      expect(result2.data?.totalQuantity).toBe(3);
    });
  });

  describe('deleteProductCart', () => {
    const mockCartSummaryResponse = {
      cartId: 1,
      userId: 123,
      cartItems: [
        {
          id: 1,
          quantity: 2,
          productVariant: {
            id: 10,
            price: 29.99,
          },
        },
      ],
      totalQuantity: 2,
      totalAmount: 59.98,
    };
    const mockSuccessCartResponse: BaseResponse<CartSummaryResponse> = {
      statusKey: StatusKey.SUCCESS,
      data: mockCartSummaryResponse,
    };
    it('should delete product in cart successfully', async () => {
      const request = { userId: 123, productVariantIds: [10] };
      const response: BaseResponse<CartSummaryResponse> = {
        ...mockSuccessCartResponse,
        data: { ...mockCartSummaryResponse, totalQuantity: 0, totalAmount: 0 },
      };

      mockCallMicroservice.mockResolvedValueOnce(response);

      const result = await service.deleteProductCart(request);

      expect(mockCallMicroservice).toHaveBeenCalledWith(
        mockCartClient.send(ProductPattern.DELETE_PRODUCT_CART, request),
        PRODUCT_SERVICE,
        mockLoggerService,
        {
          timeoutMs: TIMEOUT_MS_DEFAULT,
          retries: RETRIES_DEFAULT,
        },
      );
      expect(result.statusKey).toBe(StatusKey.SUCCESS);
      expect(result.data?.totalQuantity).toBe(0);
      expect(result.data?.totalAmount).toBe(0);
    });
    it('should throw error when userId is falsy', async () => {
      const falsyUserIds = [undefined, null, 0, false, '', NaN];
      for (const falsyUserId of falsyUserIds) {
        const requestWithFalsyUserId = {
          userId: falsyUserId as unknown as number,
          productVariantIds: [10],
        };
        await expect(service.deleteProductCart(requestWithFalsyUserId)).rejects.toThrow();
      }
      expect(mockCallMicroservice).not.toHaveBeenCalled();
    });

    it('should handle microservice returning some product not found error', async () => {
      const rpcError = {
        code: HTTP_ERROR_CODE.NOT_FOUND,
        message: 'common.product.someProductNotExist',
      };
      mockCallMicroservice.mockRejectedValueOnce(new TypedRpcException(rpcError));
      const request = { userId: 123, productVariantIds: [10] };
      try {
        await service.deleteProductCart(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
      }
      expect(mockCallMicroservice).toHaveBeenCalledWith(
        mockCartClient.send(ProductPattern.DELETE_PRODUCT_CART, request),
        PRODUCT_SERVICE,
        mockLoggerService,
        {
          timeoutMs: TIMEOUT_MS_DEFAULT,
          retries: RETRIES_DEFAULT,
        },
      );
    });
    it('should handle microservice returning cart not found error', async () => {
      const rpcError = {
        code: HTTP_ERROR_CODE.NOT_FOUND,
        message: 'common.cart.notFound',
      };
      mockCallMicroservice.mockRejectedValueOnce(new TypedRpcException(rpcError));
      const request = { userId: 123, productVariantIds: [10] };
      try {
        await service.deleteProductCart(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
      }
      expect(mockCallMicroservice).toHaveBeenCalledWith(
        mockCartClient.send(ProductPattern.DELETE_PRODUCT_CART, request),
        PRODUCT_SERVICE,
        mockLoggerService,
        {
          timeoutMs: TIMEOUT_MS_DEFAULT,
          retries: RETRIES_DEFAULT,
        },
      );
    });
  });
});
