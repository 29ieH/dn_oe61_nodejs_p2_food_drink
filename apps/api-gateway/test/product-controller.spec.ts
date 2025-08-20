import { ProductDto } from '@app/common/dto/product/product.dto';
import { AddProductCartRequest } from '@app/common/dto/product/requests/add-product-cart.request';
import { CartSummaryResponse } from '@app/common/dto/product/response/cart-summary.response';
import { ProductResponse } from '@app/common/dto/product/response/product-response';
import { VariantInput } from '@app/common/dto/product/variants.dto';
import { HTTP_ERROR_CODE } from '@app/common/enums/errors/http-error-code';
import { StatusProduct } from '@app/common/enums/product/product-status.enum';
import { StatusKey } from '@app/common/enums/status-key.enum';
import { TypedRpcException } from '@app/common/exceptions/rpc-exceptions';
import { BaseResponse } from '@app/common/interfaces/data-type';
import { AccessTokenPayload } from '@app/common/interfaces/token-payload';
import { buildBaseResponse } from '@app/common/utils/data.util';
import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { I18nService } from 'nestjs-i18n';
import { Readable } from 'stream';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { ProductController } from '../src/product/product.controller';
import { ProductService } from '../src/product/product.service';

describe('ProductController', () => {
  let controller: ProductController;
  let productService: ProductService;
  let moduleRef: TestingModule;

  const mockProductService = {
    create: jest.fn(),
    addProductCart: jest.fn(),
  };

  const mockI18nService = {
    translate: jest.fn().mockReturnValue('Mock translation'),
  };

  const mockReflector = {
    get: jest.fn(),
    getAll: jest.fn(),
    getAllAndMerge: jest.fn(),
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        {
          provide: ProductService,
          useValue: mockProductService,
        },
        {
          provide: I18nService,
          useValue: mockI18nService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = moduleRef.get<ProductController>(ProductController);
    productService = moduleRef.get<ProductService>(ProductService);
  });

  afterEach(() => {
    jest.clearAllMocks();
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

    it('should create a product successfully with valid input and files', async () => {
      const productServiceCreateSpy = jest
        .spyOn(productService, 'create')
        .mockResolvedValue(mockSuccessResponse);

      const result = await controller.create(mockProductDto, mockFiles);

      expect(productServiceCreateSpy).toHaveBeenCalledWith(mockProductDto, mockFiles);
      expect(productServiceCreateSpy).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockSuccessResponse);
      expect(result.statusKey).toBe(StatusKey.SUCCESS);
      expect(result.data).toEqual(mockProductResponse);
      expect(result.data!.id).toBe(1);
      expect(result.data!.name).toBe(mockProductDto.name);
      expect(result.data!.skuId).toBe(mockProductDto.skuId);
      expect(result.data!.images).toHaveLength(2);
      expect(result.data!.variants).toHaveLength(1);
    });

    it('should create a product successfully with empty files array', async () => {
      const emptyFiles: Express.Multer.File[] = [];
      const productServiceCreateSpy = jest
        .spyOn(productService, 'create')
        .mockResolvedValue(mockSuccessResponse);

      const result = await controller.create(mockProductDto, emptyFiles);

      expect(productServiceCreateSpy).toHaveBeenCalledWith(mockProductDto, emptyFiles);
      expect(productServiceCreateSpy).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockSuccessResponse);
    });

    it('should create a product successfully with undefined files', async () => {
      const undefinedFiles = undefined as unknown as Express.Multer.File[];
      const productServiceCreateSpy = jest
        .spyOn(productService, 'create')
        .mockResolvedValue(mockSuccessResponse);

      const result = await controller.create(mockProductDto, undefinedFiles);

      expect(productServiceCreateSpy).toHaveBeenCalledWith(mockProductDto, undefinedFiles);
      expect(productServiceCreateSpy).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockSuccessResponse);
    });

    it('should handle product creation with minimal required fields', async () => {
      const minimalProductDto: ProductDto = {
        name: 'Minimal Product',
        skuId: 'MIN-SKU-001',
        status: StatusProduct.IN_STOCK,
        basePrice: 10.0,
        quantity: 1,
        variants: [mockVariant],
        categoryIds: [1],
      };

      const minimalResponse: BaseResponse<ProductResponse> = {
        statusKey: StatusKey.SUCCESS,
        data: {
          ...mockProductResponse,
          name: 'Minimal Product',
          skuId: 'MIN-SKU-001',
          description: undefined,
          basePrice: new Decimal(10.0),
          quantity: 1,
          categoryIds: [1],
        },
      };

      const productServiceCreateSpy = jest
        .spyOn(productService, 'create')
        .mockResolvedValue(minimalResponse);

      const result = await controller.create(minimalProductDto, mockFiles);

      expect(productServiceCreateSpy).toHaveBeenCalledWith(minimalProductDto, mockFiles);
      expect(result).toEqual(minimalResponse);
      expect(result.data!.name).toBe('Minimal Product');
      expect(result.data!.description).toBeUndefined();
    });

    it('should handle product creation with multiple variants', async () => {
      const multipleVariants: VariantInput[] = [
        {
          price: 29.99,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-06-30'),
          sizeId: 1,
        },
        {
          price: 34.99,
          startDate: new Date('2024-07-01'),
          endDate: new Date('2024-12-31'),
          sizeId: 2,
        },
        {
          price: 39.99,
          startDate: new Date('2024-01-01'),
          sizeId: 3,
        },
      ];

      const productDtoWithMultipleVariants: ProductDto = {
        ...mockProductDto,
        variants: multipleVariants,
      };

      const responseWithMultipleVariants: BaseResponse<ProductResponse> = {
        statusKey: StatusKey.SUCCESS,
        data: {
          ...mockProductResponse,
          variants: multipleVariants.map((variant, index) => ({
            id: index + 1,
            ...variant,
          })),
        },
      };

      const productServiceCreateSpy = jest
        .spyOn(productService, 'create')
        .mockResolvedValue(responseWithMultipleVariants);

      const result = await controller.create(productDtoWithMultipleVariants, mockFiles);

      expect(productServiceCreateSpy).toHaveBeenCalledWith(
        productDtoWithMultipleVariants,
        mockFiles,
      );
      expect(result.data!.variants).toHaveLength(3);
      expect(result.data!.variants![0].sizeId).toBe(1);
      expect(result.data!.variants![1].sizeId).toBe(2);
      expect(result.data!.variants![2].sizeId).toBe(3);
    });

    it('should handle product creation with multiple category IDs', async () => {
      const multipleCategoryIds = [1, 2, 3, 4, 5];
      const productDtoWithMultipleCategories: ProductDto = {
        ...mockProductDto,
        categoryIds: multipleCategoryIds,
      };

      const responseWithMultipleCategories: BaseResponse<ProductResponse> = {
        statusKey: StatusKey.SUCCESS,
        data: {
          ...mockProductResponse,
          categoryIds: multipleCategoryIds,
        },
      };

      const productServiceCreateSpy = jest
        .spyOn(productService, 'create')
        .mockResolvedValue(responseWithMultipleCategories);

      const result = await controller.create(productDtoWithMultipleCategories, mockFiles);

      expect(productServiceCreateSpy).toHaveBeenCalledWith(
        productDtoWithMultipleCategories,
        mockFiles,
      );
      expect(result.data!.categoryIds).toEqual(multipleCategoryIds);
      expect(result.data!.categoryIds).toHaveLength(5);
    });

    it('should propagate BadRequestException from service', async () => {
      const errorMessage = 'Product with this SKU already exists';
      const productServiceCreateSpy = jest
        .spyOn(productService, 'create')
        .mockRejectedValue(new BadRequestException(errorMessage));

      await expect(controller.create(mockProductDto, mockFiles)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.create(mockProductDto, mockFiles)).rejects.toThrow(errorMessage);
      expect(productServiceCreateSpy).toHaveBeenCalledWith(mockProductDto, mockFiles);
    });

    it('should propagate generic Error from service', async () => {
      const errorMessage = 'Internal server error';
      const genericError = new Error(errorMessage);
      const productServiceCreateSpy = jest
        .spyOn(productService, 'create')
        .mockRejectedValue(genericError);

      await expect(controller.create(mockProductDto, mockFiles)).rejects.toThrow(Error);
      await expect(controller.create(mockProductDto, mockFiles)).rejects.toThrow(errorMessage);
      expect(productServiceCreateSpy).toHaveBeenCalledWith(mockProductDto, mockFiles);
    });

    it('should handle null input gracefully', async () => {
      const nullDto = null as unknown as ProductDto;
      const nullFiles = null as unknown as Express.Multer.File[];
      const productServiceCreateSpy = jest
        .spyOn(productService, 'create')
        .mockRejectedValue(new BadRequestException('Invalid input data'));

      await expect(controller.create(nullDto, nullFiles)).rejects.toThrow(BadRequestException);
      expect(productServiceCreateSpy).toHaveBeenCalledWith(nullDto, nullFiles);
    });

    it('should handle service returning null response', async () => {
      const nullResponse = null as unknown as BaseResponse<ProductResponse>;
      const productServiceCreateSpy = jest
        .spyOn(productService, 'create')
        .mockResolvedValue(nullResponse);

      const result = await controller.create(mockProductDto, mockFiles);

      expect(productServiceCreateSpy).toHaveBeenCalledWith(mockProductDto, mockFiles);
      expect(result).toBeNull();
    });

    it('should handle different product statuses', async () => {
      const inactiveProductDto: ProductDto = {
        ...mockProductDto,
        status: StatusProduct.SOLD_OUT,
      };

      const inactiveProductResponse: BaseResponse<ProductResponse> = {
        statusKey: StatusKey.SUCCESS,
        data: {
          ...mockProductResponse,
          status: StatusProduct.SOLD_OUT,
        },
      };

      const productServiceCreateSpy = jest
        .spyOn(productService, 'create')
        .mockResolvedValue(inactiveProductResponse);

      const result = await controller.create(inactiveProductDto, mockFiles);

      expect(productServiceCreateSpy).toHaveBeenCalledWith(inactiveProductDto, mockFiles);
      expect(result.data!.status).toBe(StatusProduct.SOLD_OUT);
    });

    it('should handle large file uploads', async () => {
      const largeFiles: Express.Multer.File[] = Array.from({ length: 10 }, (_, index) => ({
        fieldname: 'images',
        originalname: `large-image-${index + 1}.jpg`,
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 5 * 1024 * 1024, // 5MB
        buffer: Buffer.alloc(5 * 1024 * 1024),
        destination: '',
        filename: `large-image-${index + 1}.jpg`,
        path: '',
        stream: new Readable(),
      }));

      const productServiceCreateSpy = jest
        .spyOn(productService, 'create')
        .mockResolvedValue(mockSuccessResponse);

      const result = await controller.create(mockProductDto, largeFiles);

      expect(productServiceCreateSpy).toHaveBeenCalledWith(mockProductDto, largeFiles);
      expect(productServiceCreateSpy).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockSuccessResponse);
    });

    it('should handle decimal prices correctly', async () => {
      const decimalPriceDto: ProductDto = {
        ...mockProductDto,
        basePrice: 99.999,
        variants: [
          {
            ...mockVariant,
            price: 149.995,
          },
        ],
      };

      const decimalPriceResponse: BaseResponse<ProductResponse> = {
        statusKey: StatusKey.SUCCESS,
        data: {
          ...mockProductResponse,
          basePrice: new Decimal(99.999),
          variants: [
            {
              id: 1,
              price: 149.995,
              startDate: new Date('2024-01-01'),
              endDate: new Date('2024-12-31'),
              sizeId: 1,
            },
          ],
        },
      };

      const productServiceCreateSpy = jest
        .spyOn(productService, 'create')
        .mockResolvedValue(decimalPriceResponse);

      const result = await controller.create(decimalPriceDto, mockFiles);

      expect(productServiceCreateSpy).toHaveBeenCalledWith(decimalPriceDto, mockFiles);
      expect(result.data!.basePrice.toString()).toBe('99.999');
      expect(result.data!.variants![0].price).toBe(149.995);
    });

    it('should handle zero quantity products', async () => {
      const zeroQuantityDto: ProductDto = {
        ...mockProductDto,
        quantity: 0,
      };

      const zeroQuantityResponse: BaseResponse<ProductResponse> = {
        statusKey: StatusKey.SUCCESS,
        data: {
          ...mockProductResponse,
          quantity: 0,
        },
      };

      const productServiceCreateSpy = jest
        .spyOn(productService, 'create')
        .mockResolvedValue(zeroQuantityResponse);

      const result = await controller.create(zeroQuantityDto, mockFiles);

      expect(productServiceCreateSpy).toHaveBeenCalledWith(zeroQuantityDto, mockFiles);
      expect(result.data!.quantity).toBe(0);
    });
  });

  describe('addProductCart', () => {
    const user = {
      id: 123,
    } as unknown as AccessTokenPayload;
    const payload = {
      productVariantId: 10,
      quantity: 2,
    };
    const dto: AddProductCartRequest = { userId: 123, productVariantId: 10, quantity: 2 };
    const mockCartSummary: CartSummaryResponse = {
      cartId: 1,
      userId: 5,
      cartItems: [
        {
          id: 1,
          quantity: 810,
          productVariant: {
            id: 1,
            price: 20000,
          },
        },
      ],
      totalQuantity: 810,
      totalAmount: 16200000,
    };
    const successResp: BaseResponse<CartSummaryResponse> = buildBaseResponse(
      StatusKey.SUCCESS,
      mockCartSummary,
    );
    it('should add product to cart successfully', async () => {
      const addProductCartSpy = jest
        .spyOn(productService, 'addProductCart')
        .mockResolvedValue(successResp);
      const result = await controller.addProductCart(user, payload);
      expect(addProductCartSpy).toHaveBeenCalledWith(dto);
      expect(result).toEqual(successResp);
    });
    it('should propagate unauthorized error when user id is missing', async () => {
      const noIdUser = {} as AccessTokenPayload;
      const dtoMissing: AddProductCartRequest = {
        userId: undefined as unknown as number,
        productVariantId: 10,
        quantity: 2,
      };
      const rpcError = {
        code: HTTP_ERROR_CODE.UNAUTHORIZED,
        message: 'common.error.unauthorized',
      };

      const addProductCartSpy = jest
        .spyOn(productService, 'addProductCart')
        .mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await controller.addProductCart(noIdUser, payload);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
      }
      expect(addProductCartSpy).toHaveBeenCalledWith(dtoMissing);
    });
    it('should propagate error quantity not enough from service', async () => {
      const rpcError = {
        code: HTTP_ERROR_CODE.BAD_REQUEST,
        message: 'common.product.quantityNotEnough',
      };
      const addProductCartSpy = jest
        .spyOn(productService, 'addProductCart')
        .mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await controller.addProductCart(user, payload);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.BAD_REQUEST);
      }
      expect(addProductCartSpy).toHaveBeenCalledWith(dto);
    });
    it('should propagate error product not found from service', async () => {
      const rpcError = {
        code: HTTP_ERROR_CODE.NOT_FOUND,
        message: 'common.product.notFound',
      };
      const addProductCartSpy = jest
        .spyOn(productService, 'addProductCart')
        .mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await controller.addProductCart(user, payload);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.NOT_FOUND);
      }
      expect(addProductCartSpy).toHaveBeenCalledWith(dto);
    });
  });
});
