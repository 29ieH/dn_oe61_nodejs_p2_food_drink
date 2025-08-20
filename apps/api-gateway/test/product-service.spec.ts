import { PRODUCT_SERVICE } from '@app/common';
import { CloudUploadQueueService } from '@app/common/cloudinary/cloud-upload-queue/cloud-upload-queue.service';
import { CloudinaryService } from '@app/common/cloudinary/cloudinary.service';
import { RETRIES_DEFAULT, TIMEOUT_MS_DEFAULT } from '@app/common/constant/rpc.constants';
import { ProductDto } from '@app/common/dto/product/product.dto';
import { ProductResponse } from '@app/common/dto/product/response/product-response';
import { VariantInput } from '@app/common/dto/product/variants.dto';
import { StatusProduct } from '@app/common/enums/product/product-status.enum';
import { StatusKey } from '@app/common/enums/status-key.enum';
import { BaseResponse } from '@app/common/interfaces/data-type';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { Readable } from 'stream';
import { ProductService } from '../src/product/product.service';

// Mock the callMicroservice helper
jest.mock('@app/common/helpers/microservices', () => ({
  callMicroservice: jest.fn(),
}));

// Mock the buildBaseResponse utility
jest.mock('@app/common/utils/data.util', () => ({
  buildBaseResponse: jest.fn(),
}));

import { CartSummaryResponse } from '@app/common/dto/product/response/cart-summary.response';
import { HTTP_ERROR_CODE } from '@app/common/enums/errors/http-error-code';
import { TypedRpcException } from '@app/common/exceptions/rpc-exceptions';
import { callMicroservice } from '@app/common/helpers/microservices';
import { buildBaseResponse } from '@app/common/utils/data.util';
import { Decimal } from '@prisma/client/runtime/library';

describe('ProductService', () => {
  let service: ProductService;
  let moduleRef: TestingModule;

  const mockProductClient = {
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

  const mockUploadQueue = {
    enqueueUpload: jest.fn(),
  };

  const mockCloudinaryService = {
    uploadImagesToCloudinary: jest.fn(),
  };

  const mockCallMicroservice = callMicroservice as jest.MockedFunction<typeof callMicroservice>;
  const mockBuildBaseResponse = buildBaseResponse as jest.MockedFunction<typeof buildBaseResponse>;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: PRODUCT_SERVICE,
          useValue: mockProductClient,
        },
        {
          provide: CustomLogger,
          useValue: mockLoggerService,
        },
        {
          provide: I18nService,
          useValue: mockI18nService,
        },
        {
          provide: CloudUploadQueueService,
          useValue: mockUploadQueue,
        },
        {
          provide: CloudinaryService,
          useValue: mockCloudinaryService,
        },
      ],
    }).compile();

    service = moduleRef.get<ProductService>(ProductService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe('create', () => {
    const mockVariant: VariantInput = {
      price: 29.99,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      sizeId: 1,
    };

    const mockProductDto: ProductDto = {
      name: 'Test Product',
      skuId: 'TEST-SKU-001',
      description: 'Test product description',
      status: StatusProduct.IN_STOCK,
      basePrice: 25.99,
      quantity: 100,
      variants: [mockVariant],
      categoryIds: [1, 2, 3],
    };

    const mockFiles: Express.Multer.File[] = [
      {
        fieldname: 'images',
        originalname: 'test1.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('test image 1'),
        destination: '',
        filename: 'test1.jpg',
        path: '',
        stream: new Readable(),
      },
      {
        fieldname: 'images',
        originalname: 'test2.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 2048,
        buffer: Buffer.from('test image 2'),
        destination: '',
        filename: 'test2.jpg',
        path: '',
        stream: new Readable(),
      },
    ];

    const mockProductResponse: ProductResponse = {
      id: 1,
      name: 'Test Product',
      skuId: 'TEST-SKU-001',
      description: 'Test product description',
      status: StatusProduct.IN_STOCK,
      basePrice: new Decimal(25.99),
      quantity: 100,
      images: [
        {
          id: 1,
          url: 'https://cloudinary.com/image1.jpg',
        },
        {
          id: 2,
          url: 'https://cloudinary.com/image2.jpg',
        },
      ],
      variants: [
        {
          id: 1,
          price: 29.99,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          sizeId: 1,
        },
      ],
      categoryIds: [1, 2, 3],
    };

    const mockSuccessResponse: BaseResponse<ProductResponse> = {
      statusKey: StatusKey.SUCCESS,
      data: mockProductResponse,
    };

    it('should create a product successfully when product does not exist', async () => {
      const mockImagesUrl = [
        'https://cloudinary.com/image1.jpg',
        'https://cloudinary.com/image2.jpg',
      ];

      // Mock product existence check - returns null (product doesn't exist)
      mockCallMicroservice.mockResolvedValueOnce(null);

      // Mock image upload
      mockCloudinaryService.uploadImagesToCloudinary.mockResolvedValueOnce(mockImagesUrl);

      // Mock product creation
      mockCallMicroservice.mockResolvedValueOnce(mockProductResponse);

      // Mock buildBaseResponse
      mockBuildBaseResponse.mockReturnValue(mockSuccessResponse);

      const result = await service.create(mockProductDto, mockFiles);

      // Verify product existence check
      expect(mockCallMicroservice).toHaveBeenNthCalledWith(
        1,
        mockProductClient.send('check-product-exists', mockProductDto.skuId),
        PRODUCT_SERVICE,
        mockLoggerService,
        {
          timeoutMs: TIMEOUT_MS_DEFAULT,
          retries: RETRIES_DEFAULT,
        },
      );

      // Verify image upload calls
      expect(mockCloudinaryService.uploadImagesToCloudinary).toHaveBeenCalledTimes(1);
      expect(mockCloudinaryService.uploadImagesToCloudinary).toHaveBeenCalledWith(mockFiles);

      // Verify product creation call
      expect(mockCallMicroservice).toHaveBeenNthCalledWith(
        2,
        mockProductClient.send('create-product', {
          productData: mockProductDto,
          secureUrl: mockImagesUrl,
        }),
        PRODUCT_SERVICE,
        mockLoggerService,
        {
          timeoutMs: TIMEOUT_MS_DEFAULT,
          retries: RETRIES_DEFAULT,
        },
      );

      // Verify buildBaseResponse call
      expect(mockBuildBaseResponse).toHaveBeenCalledWith(StatusKey.SUCCESS, mockProductResponse);

      expect(result).toEqual(mockSuccessResponse);
    });

    it('should throw BadRequestException when product already exists', async () => {
      // Mock product exists check to return truthy value
      mockCallMicroservice.mockResolvedValueOnce({ data: mockProductResponse });
      mockI18nService.translate.mockReturnValue('Product already exists');

      await expect(service.create(mockProductDto, mockFiles)).rejects.toThrow(BadRequestException);

      expect(mockI18nService.translate).toHaveBeenCalledWith('common.product.error.productExists');
      expect(mockCloudinaryService.uploadImagesToCloudinary).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when files array is empty', async () => {
      const emptyFiles: Express.Multer.File[] = [];
      mockCallMicroservice.mockResolvedValueOnce(null);
      mockI18nService.translate.mockReturnValue('Files are required');

      await expect(service.create(mockProductDto, emptyFiles)).rejects.toThrow(BadRequestException);

      expect(mockCallMicroservice).toHaveBeenCalledTimes(1);
      expect(mockI18nService.translate).toHaveBeenCalledWith('common.product.error.filesExists');
      expect(mockCloudinaryService.uploadImagesToCloudinary).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when files is undefined', async () => {
      const undefinedFiles: Express.Multer.File[] = undefined as unknown as Express.Multer.File[];
      mockCallMicroservice.mockResolvedValueOnce(null);
      mockI18nService.translate.mockReturnValue('Files are required');

      await expect(service.create(mockProductDto, undefinedFiles)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockCallMicroservice).toHaveBeenCalledTimes(1);
      expect(mockI18nService.translate).toHaveBeenCalledWith('common.product.error.filesExists');
      expect(mockCloudinaryService.uploadImagesToCloudinary).not.toHaveBeenCalled();
    });

    it('should handle microservice call failure for product existence check', async () => {
      const microserviceError = new Error('Microservice connection failed');

      mockCallMicroservice.mockRejectedValueOnce(microserviceError);

      await expect(service.create(mockProductDto, mockFiles)).rejects.toThrow(microserviceError);

      expect(mockCallMicroservice).toHaveBeenCalledTimes(1);
      expect(mockCloudinaryService.uploadImagesToCloudinary).not.toHaveBeenCalled();
    });

    it('should handle image upload failure', async () => {
      const uploadError = new Error('Image upload failed');

      mockCallMicroservice.mockResolvedValueOnce(null);
      mockCloudinaryService.uploadImagesToCloudinary.mockRejectedValueOnce(uploadError);

      await expect(service.create(mockProductDto, [mockFiles[0]])).rejects.toThrow(uploadError);

      expect(mockCallMicroservice).toHaveBeenCalledTimes(1);
      expect(mockCloudinaryService.uploadImagesToCloudinary).toHaveBeenCalledTimes(1);
    });

    it('should handle product creation microservice failure', async () => {
      const mockImagesUrl = ['https://cloudinary.com/image1.jpg'];
      const creationError = new Error('Product creation failed');

      mockCallMicroservice.mockResolvedValueOnce(null);
      mockCloudinaryService.uploadImagesToCloudinary.mockResolvedValueOnce(mockImagesUrl);
      mockCallMicroservice.mockRejectedValueOnce(creationError);

      await expect(service.create(mockProductDto, [mockFiles[0]])).rejects.toThrow(creationError);

      expect(mockCallMicroservice).toHaveBeenCalledTimes(2);
      expect(mockCloudinaryService.uploadImagesToCloudinary).toHaveBeenCalledTimes(1);
    });

    it('should handle null product creation response', async () => {
      const mockImagesUrl = ['https://cloudinary.com/image1.jpg'];
      mockCallMicroservice.mockResolvedValueOnce(null);
      mockCloudinaryService.uploadImagesToCloudinary.mockResolvedValueOnce(mockImagesUrl);
      mockCallMicroservice.mockResolvedValueOnce(null);
      mockI18nService.translate.mockReturnValue('Product creation failed');
      mockBuildBaseResponse.mockReturnValue(mockSuccessResponse);

      const result = await service.create(mockProductDto, [mockFiles[0]]);

      expect(mockCallMicroservice).toHaveBeenCalledTimes(2);
      expect(mockCloudinaryService.uploadImagesToCloudinary).toHaveBeenCalledTimes(1);
      expect(mockI18nService.translate).toHaveBeenCalledWith('common.product.error.failed');
      expect(result).toBeDefined();
    });

    it('should handle CloudinaryService throwing BadRequestException for empty files', async () => {
      const uploadError = new BadRequestException('Files are required');

      mockCallMicroservice.mockResolvedValueOnce(null);
      mockCloudinaryService.uploadImagesToCloudinary.mockRejectedValueOnce(uploadError);

      await expect(service.create(mockProductDto, mockFiles)).rejects.toThrow(BadRequestException);

      expect(mockCallMicroservice).toHaveBeenCalledTimes(1);
      expect(mockCloudinaryService.uploadImagesToCloudinary).toHaveBeenCalledTimes(1);
    });

    it('should validate files before checking product existence', async () => {
      const emptyFiles: Express.Multer.File[] = [];
      mockI18nService.translate.mockReturnValue('Files are required');

      await expect(service.create(mockProductDto, emptyFiles)).rejects.toThrow(BadRequestException);

      // Should not call microservice if files validation fails
      expect(mockCallMicroservice).toHaveBeenCalledTimes(1);
      expect(mockI18nService.translate).toHaveBeenCalledWith('common.product.error.filesExists');
    });

    it('should handle null files parameter', async () => {
      const nullFiles = null as unknown as Express.Multer.File[];
      mockCallMicroservice.mockResolvedValueOnce(null);
      mockI18nService.translate.mockReturnValue('Files are required');

      await expect(service.create(mockProductDto, nullFiles)).rejects.toThrow(BadRequestException);

      expect(mockCallMicroservice).toHaveBeenCalledTimes(1);
      expect(mockI18nService.translate).toHaveBeenCalledWith('common.product.error.filesExists');
      expect(mockCloudinaryService.uploadImagesToCloudinary).not.toHaveBeenCalled();
    });
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

    const mockSuccessCartResponse: BaseResponse<any> = {
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
        mockProductClient.send('add-product-cart', mockAddProductCartRequest),
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
        mockProductClient.send('add-product-cart', mockAddProductCartRequest),
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
        mockProductClient.send('add-product-cart', mockAddProductCartRequest),
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
        mockProductClient.send('add-product-cart', mockAddProductCartRequest),
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
        mockProductClient.send('add-product-cart', multipleQuantityRequest),
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
        mockProductClient.send('add-product-cart', mockAddProductCartRequest),
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
        mockProductClient.send('add-product-cart', maxQuantityRequest),
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
        mockProductClient.send('add-product-cart', negativeQuantityRequest),
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
        mockProductClient.send('add-product-cart', zeroQuantityRequest),
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
        mockProductClient.send('add-product-cart', mockAddProductCartRequest),
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
        mockProductClient.send('add-product-cart', mockAddProductCartRequest),
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
});
