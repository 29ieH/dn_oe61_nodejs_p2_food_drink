import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from '../src/product-service.service';
import { PrismaService } from '@app/prisma';
import { CreateProductDto } from '@app/common/dto/product/create-product.dto';
import { ProductDto } from '@app/common/dto/product/product.dto';
import { VariantInput } from '@app/common/dto/product/variants.dto';
import { StatusProduct } from '@app/common/enums/product/product-status.enum';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { DeleteSoftCartRequest } from '@app/common/dto/product/requests/delete-soft-cart.request';
import { HTTP_ERROR_CODE } from '@app/common/enums/errors/http-error-code';
import { TypedRpcException } from '@app/common/exceptions/rpc-exceptions';
import * as prismaClientError from '@app/common/utils/prisma-client-error';
import { StatusKey } from '@app/common/enums/status-key.enum';
import { AddProductCartRequest } from '@app/common/dto/product/requests/add-product-cart.request';

jest.mock('class-validator', () => {
  const actual = jest.requireActual<typeof import('class-validator')>('class-validator');
  return {
    ...actual,
    validateOrReject: jest.fn<Promise<void>, [unknown]>(),
  };
});

jest.mock('class-transformer', () => {
  const actual = jest.requireActual<typeof import('class-transformer')>('class-transformer');
  return {
    ...actual,
    plainToInstance: jest.fn(),
  };
});

jest.mock('@app/common/utils/prisma-client-error');

const mockValidateOrReject = validateOrReject as jest.MockedFunction<typeof validateOrReject>;
const mockPlainToInstance = plainToInstance as jest.MockedFunction<typeof plainToInstance>;

interface MockProduct {
  id: number;
  skuId: string;
  name: string;
  description?: string;
  status: StatusProduct;
  basePrice: number;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

interface MockPrismaTransaction {
  product: {
    create: jest.MockedFunction<(args: { data: Partial<MockProduct> }) => Promise<MockProduct>>;
  };
  productImage: {
    create: jest.MockedFunction<
      (args: { data: { url: string; productId: number } }) => Promise<{ id: number }>
    >;
  };
  productVariant: {
    create: jest.MockedFunction<
      (args: {
        data: {
          price: number;
          startDate: Date;
          endDate: Date | null;
          productId: number;
          sizeId: number;
        };
      }) => Promise<{ id: number }>
    >;
  };
  categoryProduct: {
    create: jest.MockedFunction<
      (args: { data: { categoryId: number; productId: number } }) => Promise<{ id: number }>
    >;
  };
  cart: {
    findUnique: jest.MockedFunction<
      (args: { where: { userId: number } }) => Promise<{ id: number } | null>
    >;
    update: jest.MockedFunction<
      (args: { where: { userId: number }; data: { deletedAt: Date } }) => Promise<{ id: number }>
    >;
    upsert: jest.MockedFunction<
      (args: {
        where: { userId: number };
        create: { userId: number };
        update: { userId: number };
      }) => Promise<{ id: number }>
    >;
    findUniqueOrThrow: jest.MockedFunction<
      (args: { where: { userId: number } }) => Promise<{ id: number; userId: number; items: any[] }>
    >;
    $transaction: jest.MockedFunction<(callback: TransactionCallback) => Promise<MockProduct>>;
  };
  cartItem: {
    findUnique: jest.MockedFunction<
      (args: {
        where: { cartId: number; productVariantId: number };
      }) => Promise<{ userId: number } | null>
    >;
    create: jest.MockedFunction<
      (args: {
        data: { quantity: number; cartId: number; productVariantId: number };
      }) => Promise<any>
    >;
    update: jest.MockedFunction<
      (args: { where: { id: number }; data: { quantity: number } }) => Promise<any>
    >;
  };
}

type TransactionCallback = (prisma: MockPrismaTransaction) => Promise<MockProduct>;

describe('ProductService', () => {
  let service: ProductService;

  const mockPrismaService = {
    client: {
      product: {
        findUnique: jest.fn() as jest.MockedFunction<
          (args: { where: { skuId: string } }) => Promise<MockProduct | null>
        >,
        create: jest.fn() as jest.MockedFunction<
          (args: { data: Partial<MockProduct> }) => Promise<MockProduct>
        >,
      },
      productImage: {
        create: jest.fn() as jest.MockedFunction<
          (args: { data: { url: string; productId: number } }) => Promise<{ id: number }>
        >,
      },
      productVariant: {
        create: jest.fn() as jest.MockedFunction<
          (args: {
            data: {
              price: number;
              startDate: Date;
              endDate: Date | null;
              productId: number;
              sizeId: number;
            };
          }) => Promise<{ id: number }>
        >,
        findUnique: jest.fn() as jest.MockedFunction<
          (args: { where: { id: number } }) => Promise<{ id: number } | null>
        >,
      },
      categoryProduct: {
        create: jest.fn() as jest.MockedFunction<
          (args: { data: { categoryId: number; productId: number } }) => Promise<{ id: number }>
        >,
      },
      cart: {
        findUnique: jest.fn() as jest.MockedFunction<
          (args: { where: { userId: number } }) => Promise<{ id: number } | null>
        >,
        update: jest.fn() as jest.MockedFunction<
          (args: {
            where: { userId: number };
            data: { deletedAt: Date };
          }) => Promise<{ id: number }>
        >,
        upsert: jest.fn() as jest.MockedFunction<
          (args: {
            where: { userId: number };
            create: { userId: number };
            update: { userId: number };
          }) => Promise<{ id: number }>
        >,
        findUniqueOrThrow: jest.fn() as jest.MockedFunction<
          (args: {
            where: { userId: number };
          }) => Promise<{ id: number; userId: number; items: any[] }>
        >,
        $transaction: jest.fn() as jest.MockedFunction<
          (callback: TransactionCallback) => Promise<MockProduct>
        >,
      },
      cartItem: {
        findUnique: jest.fn() as jest.MockedFunction<
          (args: {
            where: { cartId: number; productVariantId: number };
          }) => Promise<{ userId: number } | null>
        >,
        create: jest.fn() as jest.MockedFunction<
          (args: {
            data: { quantity: number; cartId: number; productVariantId: number };
          }) => Promise<any>
        >,
        update: jest.fn() as jest.MockedFunction<
          (args: { where: { id: number }; data: { quantity: number } }) => Promise<any>
        >,
      },
      $transaction: jest.fn() as jest.MockedFunction<
        (callback: TransactionCallback) => Promise<MockProduct>
      >,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        { provide: CustomLogger, useValue: { error: jest.fn(), log: jest.fn() } },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe('checkProductExists', () => {
    it('should return a product if it exists', async () => {
      const skuId = 'EXISTING-SKU';
      const mockProduct: MockProduct = {
        id: 1,
        skuId,
        name: 'Test Product',
        description: 'Test Description',
        status: StatusProduct.IN_STOCK,
        basePrice: 99.99,
        quantity: 10,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      };
      mockPrismaService.client.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.checkProductExists(skuId);

      expect(result).toEqual(mockProduct);
      expect(mockPrismaService.client.product.findUnique).toHaveBeenCalledWith({
        where: { skuId },
      });
      expect(mockPrismaService.client.product.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should return null if the product does not exist', async () => {
      const skuId = 'NON-EXISTING-SKU';
      mockPrismaService.client.product.findUnique.mockResolvedValue(null);

      const result = await service.checkProductExists(skuId);

      expect(result).toBeNull();
      expect(mockPrismaService.client.product.findUnique).toHaveBeenCalledWith({
        where: { skuId },
      });
      expect(mockPrismaService.client.product.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors', async () => {
      const skuId = 'ERROR-SKU';
      const databaseError = new Error('Database connection failed');
      mockPrismaService.client.product.findUnique.mockRejectedValue(databaseError);

      await expect(service.checkProductExists(skuId)).rejects.toThrow(databaseError);
      expect(mockPrismaService.client.product.findUnique).toHaveBeenCalledWith({
        where: { skuId },
      });
      expect(mockPrismaService.client.product.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('createProduct', () => {
    const mockVariants: VariantInput[] = [
      {
        price: 109.99,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        sizeId: 1,
      },
      {
        price: 119.99,
        startDate: new Date('2024-01-01'),
        endDate: undefined, // Test optional endDate
        sizeId: 2,
      },
    ];

    const mockProductData: ProductDto = {
      skuId: 'NEW-SKU',
      name: 'New Product',
      description: 'A great new product',
      status: StatusProduct.IN_STOCK,
      basePrice: 99.99,
      quantity: 10,
      variants: mockVariants,
      categoryIds: [1, 2],
    };

    const mockSecureUrl: string[] = [
      'http://example.com/image1.jpg',
      'http://example.com/image2.jpg',
    ];

    const mockCreateProductDto: CreateProductDto = {
      productData: mockProductData,
      secureUrl: mockSecureUrl,
    };

    const mockCreatedProduct: MockProduct = {
      id: 1,
      skuId: mockProductData.skuId,
      name: mockProductData.name,
      description: mockProductData.description,
      status: mockProductData.status,
      basePrice: mockProductData.basePrice,
      quantity: mockProductData.quantity,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    };

    it('should create a product successfully', async () => {
      const mockDto = { ...mockCreateProductDto };
      mockPlainToInstance.mockReturnValue(mockDto);
      mockValidateOrReject.mockResolvedValue(undefined);

      mockPrismaService.client.$transaction.mockImplementation(
        async (callback: TransactionCallback) => {
          const prismaMock: MockPrismaTransaction = {
            product: {
              create: jest.fn().mockResolvedValue(mockCreatedProduct),
            },
            productImage: {
              create: jest.fn().mockResolvedValue({ id: 1 }),
            },
            productVariant: {
              create: jest.fn().mockResolvedValue({ id: 1 }),
            },
            categoryProduct: {
              create: jest.fn().mockResolvedValue({ id: 1 }),
            },
            cart: {
              findUnique: jest.fn(),
              update: jest.fn(),
              upsert: jest.fn(),
              findUniqueOrThrow: jest.fn(),
              $transaction: jest.fn() as jest.MockedFunction<
                (callback: TransactionCallback) => Promise<MockProduct>
              >,
            },
            cartItem: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          };
          return await callback(prismaMock);
        },
      );

      const result = await service.createProduct(mockCreateProductDto);

      expect(mockPlainToInstance).toHaveBeenCalledWith(CreateProductDto, mockCreateProductDto);
      expect(mockValidateOrReject).toHaveBeenCalledWith(mockDto);
      expect(mockPrismaService.client.$transaction).toHaveBeenCalledTimes(1);
      expect(result?.id).toEqual(mockCreatedProduct.id);
      expect(result?.basePrice.toString()).toEqual(mockCreatedProduct.basePrice.toString());
    });

    it('should throw an error if validation fails', async () => {
      const mockDto = { ...mockCreateProductDto };
      const validationError = new Error('Validation failed');
      mockPlainToInstance.mockReturnValue(mockDto);
      mockValidateOrReject.mockRejectedValue(validationError);

      await expect(service.createProduct(mockCreateProductDto)).rejects.toThrow(validationError);

      expect(mockPlainToInstance).toHaveBeenCalledWith(CreateProductDto, mockCreateProductDto);
      expect(mockValidateOrReject).toHaveBeenCalledWith(mockDto);
      expect(mockPrismaService.client.$transaction).not.toHaveBeenCalled();
    });

    it('should throw an error if the transaction fails', async () => {
      const mockDto = { ...mockCreateProductDto };
      const transactionError = new Error('Transaction failed');
      mockPlainToInstance.mockReturnValue(mockDto);
      mockValidateOrReject.mockResolvedValue(undefined);
      mockPrismaService.client.$transaction.mockRejectedValue(transactionError);

      await expect(service.createProduct(mockCreateProductDto)).rejects.toThrow(transactionError);

      expect(mockPlainToInstance).toHaveBeenCalledWith(CreateProductDto, mockCreateProductDto);
      expect(mockValidateOrReject).toHaveBeenCalledWith(mockDto);
      expect(mockPrismaService.client.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should handle product creation failure within transaction', async () => {
      const mockDto = { ...mockCreateProductDto };
      const productCreationError = new Error('Product creation failed');
      mockPlainToInstance.mockReturnValue(mockDto);
      mockValidateOrReject.mockResolvedValue(undefined);

      mockPrismaService.client.$transaction.mockImplementation(
        async (callback: TransactionCallback) => {
          const prismaMock: MockPrismaTransaction = {
            product: {
              create: jest.fn().mockRejectedValue(productCreationError),
            },
            productImage: {
              create: jest.fn().mockResolvedValue({ id: 1 }),
            },
            productVariant: {
              create: jest.fn().mockResolvedValue({ id: 1 }),
            },
            categoryProduct: {
              create: jest.fn().mockResolvedValue({ id: 1 }),
            },
            cart: {
              findUnique: jest.fn(),
              update: jest.fn(),
              upsert: jest.fn(),
              findUniqueOrThrow: jest.fn(),
              $transaction: jest.fn() as jest.MockedFunction<
                (callback: TransactionCallback) => Promise<MockProduct>
              >,
            },
            cartItem: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          };
          return await callback(prismaMock);
        },
      );

      await expect(service.createProduct(mockCreateProductDto)).rejects.toThrow(
        productCreationError,
      );

      expect(mockPlainToInstance).toHaveBeenCalledWith(CreateProductDto, mockCreateProductDto);
      expect(mockValidateOrReject).toHaveBeenCalledWith(mockDto);
      expect(mockPrismaService.client.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should handle image creation failure within transaction', async () => {
      const mockDto = { ...mockCreateProductDto };
      const imageCreationError = new Error('Image creation failed');
      mockPlainToInstance.mockReturnValue(mockDto);
      mockValidateOrReject.mockResolvedValue(undefined);

      mockPrismaService.client.$transaction.mockImplementation(
        async (callback: TransactionCallback) => {
          const prismaMock: MockPrismaTransaction = {
            product: {
              create: jest.fn().mockResolvedValue(mockCreatedProduct),
            },
            productImage: {
              create: jest.fn().mockRejectedValue(imageCreationError),
            },
            productVariant: {
              create: jest.fn().mockResolvedValue({ id: 1 }),
            },
            categoryProduct: {
              create: jest.fn().mockResolvedValue({ id: 1 }),
            },
            cart: {
              findUnique: jest.fn(),
              update: jest.fn(),
              upsert: jest.fn(),
              findUniqueOrThrow: jest.fn(),
              $transaction: jest.fn() as jest.MockedFunction<
                (callback: TransactionCallback) => Promise<MockProduct>
              >,
            },
            cartItem: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          };
          return await callback(prismaMock);
        },
      );

      await expect(service.createProduct(mockCreateProductDto)).rejects.toThrow(imageCreationError);

      expect(mockPlainToInstance).toHaveBeenCalledWith(CreateProductDto, mockCreateProductDto);
      expect(mockValidateOrReject).toHaveBeenCalledWith(mockDto);
      expect(mockPrismaService.client.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should handle variant creation failure within transaction', async () => {
      const mockDto = { ...mockCreateProductDto };
      const variantCreationError = new Error('Variant creation failed');
      mockPlainToInstance.mockReturnValue(mockDto);
      mockValidateOrReject.mockResolvedValue(undefined);

      mockPrismaService.client.$transaction.mockImplementation(
        async (callback: TransactionCallback) => {
          const prismaMock: MockPrismaTransaction = {
            product: {
              create: jest.fn().mockResolvedValue(mockCreatedProduct),
            },
            productImage: {
              create: jest.fn().mockResolvedValue({ id: 1 }),
            },
            productVariant: {
              create: jest.fn().mockRejectedValue(variantCreationError),
            },
            categoryProduct: {
              create: jest.fn().mockResolvedValue({ id: 1 }),
            },
            cart: {
              findUnique: jest.fn(),
              update: jest.fn(),
              upsert: jest.fn(),
              findUniqueOrThrow: jest.fn(),
              $transaction: jest.fn() as jest.MockedFunction<
                (callback: TransactionCallback) => Promise<MockProduct>
              >,
            },
            cartItem: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          };
          return await callback(prismaMock);
        },
      );

      await expect(service.createProduct(mockCreateProductDto)).rejects.toThrow(
        variantCreationError,
      );

      expect(mockPlainToInstance).toHaveBeenCalledWith(CreateProductDto, mockCreateProductDto);
      expect(mockValidateOrReject).toHaveBeenCalledWith(mockDto);
      expect(mockPrismaService.client.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should handle category creation failure within transaction', async () => {
      const mockDto = { ...mockCreateProductDto };
      const categoryCreationError = new Error('Category creation failed');
      mockPlainToInstance.mockReturnValue(mockDto);
      mockValidateOrReject.mockResolvedValue(undefined);

      mockPrismaService.client.$transaction.mockImplementation(
        async (callback: TransactionCallback) => {
          const prismaMock: MockPrismaTransaction = {
            product: {
              create: jest.fn().mockResolvedValue(mockCreatedProduct),
            },
            productImage: {
              create: jest.fn().mockResolvedValue({ id: 1 }),
            },
            productVariant: {
              create: jest.fn().mockResolvedValue({ id: 1 }),
            },
            categoryProduct: {
              create: jest.fn().mockRejectedValue(categoryCreationError),
            },
            cart: {
              findUnique: jest.fn(),
              update: jest.fn(),
              upsert: jest.fn(),
              findUniqueOrThrow: jest.fn(),
              $transaction: jest.fn() as jest.MockedFunction<
                (callback: TransactionCallback) => Promise<MockProduct>
              >,
            },
            cartItem: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          };
          return await callback(prismaMock);
        },
      );

      await expect(service.createProduct(mockCreateProductDto)).rejects.toThrow(
        categoryCreationError,
      );

      expect(mockPlainToInstance).toHaveBeenCalledWith(CreateProductDto, mockCreateProductDto);
      expect(mockValidateOrReject).toHaveBeenCalledWith(mockDto);
      expect(mockPrismaService.client.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should handle variants with null endDate correctly', async () => {
      const mockDto = { ...mockCreateProductDto };
      mockPlainToInstance.mockReturnValue(mockDto);
      mockValidateOrReject.mockResolvedValue(undefined);

      const capturedVariantData: {
        price: number;
        startDate: Date;
        endDate: Date | null;
        productId: number;
        sizeId: number;
      }[] = [];

      mockPrismaService.client.$transaction.mockImplementation(
        async (callback: TransactionCallback) => {
          const prismaMock: MockPrismaTransaction = {
            product: {
              create: jest.fn().mockResolvedValue(mockCreatedProduct),
            },
            productImage: {
              create: jest.fn().mockResolvedValue({ id: 1 }),
            },
            productVariant: {
              create: jest.fn().mockImplementation(
                (args: {
                  data: {
                    price: number;
                    startDate: Date;
                    endDate: Date | null;
                    productId: number;
                    sizeId: number;
                  };
                }) => {
                  capturedVariantData.push(args.data);
                  return Promise.resolve({ id: 1 });
                },
              ),
            },
            categoryProduct: {
              create: jest.fn().mockResolvedValue({ id: 1 }),
            },
            cart: {
              findUnique: jest.fn(),
              update: jest.fn(),
              upsert: jest.fn(),
              findUniqueOrThrow: jest.fn(),
              $transaction: jest.fn() as jest.MockedFunction<
                (callback: TransactionCallback) => Promise<MockProduct>
              >,
            },
            cartItem: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          };
          return await callback(prismaMock);
        },
      );

      const result = await service.createProduct(mockCreateProductDto);

      expect(result?.id).toEqual(mockCreatedProduct.id);
      expect(result?.basePrice.toString()).toEqual(mockCreatedProduct.basePrice.toString());
      expect(capturedVariantData).toHaveLength(2);
      expect(capturedVariantData[0].endDate).toBeInstanceOf(Date);
      expect(capturedVariantData[1].endDate).toBeNull();
    });
  });

  describe('deleteSoftCart', () => {
    const dto: DeleteSoftCartRequest = { userId: 1 } as DeleteSoftCartRequest;

    it('should update cart.deletedAt when cart exists', async () => {
      mockPrismaService.client.cart.findUnique.mockResolvedValueOnce({ id: 10 });
      mockPrismaService.client.cart.update.mockResolvedValueOnce({ id: 10 });

      await service.deleteSoftCart(dto);

      expect(mockPrismaService.client.cart.findUnique).toHaveBeenCalledWith({
        where: { userId: dto.userId },
      });
      expect(mockPrismaService.client.cart.update).toHaveBeenCalledWith({
        where: { userId: dto.userId },
        data: { deletedAt: expect.any(Date) as unknown as Date },
      });
    });

    it('should do nothing when cart not found', async () => {
      mockPrismaService.client.cart.findUnique.mockResolvedValueOnce(null);

      await service.deleteSoftCart(dto);

      expect(mockPrismaService.client.cart.update).not.toHaveBeenCalled();
    });

    it('should propagate prisma error via handlePrismaError', async () => {
      const prismaErr = new Error('db fail');
      mockPrismaService.client.cart.findUnique.mockRejectedValueOnce(prismaErr);
      const mappedErr = new TypedRpcException({ code: HTTP_ERROR_CODE.CONFLICT, message: 'msg' });
      jest.spyOn(prismaClientError, 'handlePrismaError').mockReturnValueOnce(mappedErr as never);
      const result = await service.deleteSoftCart(dto);
      expect(result).toBe(mappedErr);
      expect(prismaClientError.handlePrismaError).toHaveBeenCalledWith(
        prismaErr,
        'ProductService',
        'deleteSoftCart',
        expect.anything(),
      );
    });
  });

  describe('addProductCart', () => {
    const mockAddProductCartRequest = {
      userId: 123,
      productVariantId: 10,
      quantity: 2,
    };

    const mockCart = { id: 1, userId: 123 };
    const mockProductVariant = {
      id: 10,
      price: 29.99,
      product: { quantity: 100 },
    };

    const mockCartItem = {
      id: 1,
      quantity: 2,
      cartId: 1,
      productVariantId: 10,
    };

    const mockCartSummary = {
      id: 1,
      userId: 123,
      items: [
        {
          id: 1,
          quantity: 2,
          productVariant: {
            id: 10,
            price: 29.99,
          },
        },
      ],
    };

    beforeEach(() => {
      mockPrismaService.client.cart = {
        findUnique: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        $transaction: jest.fn() as jest.MockedFunction<
          (callback: TransactionCallback) => Promise<MockProduct>
        >,
      };
      mockPrismaService.client.productVariant = {
        create: jest.fn(),
        findUnique: jest.fn(),
      };
      mockPrismaService.client.cartItem = {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };
    });

    it('should successfully add product to new cart', async () => {
      const mockDto = { ...mockAddProductCartRequest };
      mockPlainToInstance.mockReturnValue(mockDto);
      mockValidateOrReject.mockResolvedValue(undefined);

      (mockPrismaService.client.cart.upsert as jest.Mock).mockResolvedValue(mockCart);

      (mockPrismaService.client.productVariant.findUnique as jest.Mock).mockResolvedValue(
        mockProductVariant,
      );

      (mockPrismaService.client.cartItem.findUnique as jest.Mock).mockResolvedValue(null);

      (mockPrismaService.client.cartItem.create as jest.Mock).mockResolvedValue(mockCartItem);

      (mockPrismaService.client.cart.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        mockCartSummary,
      );
      const result = await service.addProductCart(mockAddProductCartRequest);
      expect(mockPlainToInstance).toHaveBeenCalledWith(
        AddProductCartRequest,
        mockAddProductCartRequest,
      );
      expect(mockValidateOrReject).toHaveBeenCalledWith(mockDto);
      expect(mockPrismaService.client.cart.upsert).toHaveBeenCalledWith({
        where: { userId: mockAddProductCartRequest.userId },
        create: { userId: mockAddProductCartRequest.userId },
        update: {},
      });
      expect(mockPrismaService.client.productVariant.findUnique).toHaveBeenCalledWith({
        where: { id: mockAddProductCartRequest.productVariantId },
        select: {
          id: true,
          price: true,
          product: { select: { quantity: true } },
        },
      });
      expect(mockPrismaService.client.cartItem.create).toHaveBeenCalledWith({
        data: {
          quantity: mockAddProductCartRequest.quantity,
          cartId: mockCart.id,
          productVariantId: mockAddProductCartRequest.productVariantId,
        },
      });
      expect(result.statusKey).toBe(StatusKey.SUCCESS);
      expect(result.data).toBeDefined();
    });

    it('should successfully add product to existing cart item (update quantity)', async () => {
      const existingCartItem = { id: 1, quantity: 3, cartId: 1, productVariantId: 10 };
      const mockDto = { ...mockAddProductCartRequest };

      mockPlainToInstance.mockReturnValue(mockDto);
      mockValidateOrReject.mockResolvedValue(undefined);
      (mockPrismaService.client.cart.upsert as jest.Mock).mockResolvedValue(mockCart);
      (mockPrismaService.client.productVariant.findUnique as jest.Mock).mockResolvedValue(
        mockProductVariant,
      );
      (mockPrismaService.client.cartItem.findUnique as jest.Mock).mockResolvedValue(
        existingCartItem,
      );
      (mockPrismaService.client.cartItem.update as jest.Mock).mockResolvedValue({
        ...existingCartItem,
        quantity: 5,
      });
      (mockPrismaService.client.cart.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        mockCartSummary,
      );

      const result = await service.addProductCart(mockAddProductCartRequest);

      expect(mockPrismaService.client.cartItem.update).toHaveBeenCalledWith({
        where: { id: existingCartItem.id },
        data: { quantity: existingCartItem.quantity + mockAddProductCartRequest.quantity },
      });

      expect(mockPrismaService.client.cartItem.create).not.toHaveBeenCalled();
      expect(result.statusKey).toBe(StatusKey.SUCCESS);
    });

    it('should throw TypedRpcException when product variant not found', async () => {
      const mockDto = { ...mockAddProductCartRequest };
      mockPlainToInstance.mockReturnValue(mockDto);
      mockValidateOrReject.mockResolvedValue(undefined);
      (mockPrismaService.client.cart.upsert as jest.Mock).mockResolvedValue(mockCart);
      (mockPrismaService.client.productVariant.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.addProductCart(mockAddProductCartRequest)).rejects.toThrow(
        TypedRpcException,
      );

      try {
        await service.addProductCart(mockAddProductCartRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError().code).toBe(HTTP_ERROR_CODE.NOT_FOUND);
        expect((error as TypedRpcException).getError().message).toBe('common.product.notFound');
      }
    });

    it('should throw TypedRpcException when quantity exceeds available stock', async () => {
      const lowStockVariant = {
        id: 10,
        price: 29.99,
        product: { quantity: 5 },
      };
      const existingCartItem = { id: 1, quantity: 3, cartId: 1, productVariantId: 10 }; // 3 already in cart
      const mockDto = { ...mockAddProductCartRequest, quantity: 3 };

      mockPlainToInstance.mockReturnValue(mockDto);
      mockValidateOrReject.mockResolvedValue(undefined);
      (mockPrismaService.client.cart.upsert as jest.Mock).mockResolvedValue(mockCart);
      (mockPrismaService.client.productVariant.findUnique as jest.Mock).mockResolvedValue(
        lowStockVariant,
      );
      (mockPrismaService.client.cartItem.findUnique as jest.Mock).mockResolvedValue(
        existingCartItem,
      );

      await expect(
        service.addProductCart({ ...mockAddProductCartRequest, quantity: 3 }),
      ).rejects.toThrow(TypedRpcException);

      try {
        await service.addProductCart({ ...mockAddProductCartRequest, quantity: 3 });
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError().code).toBe(HTTP_ERROR_CODE.BAD_REQUEST);
        expect((error as TypedRpcException).getError().message).toBe(
          'common.product.quantityNotEnough',
        );
      }
    });

    it('should handle validation errors', async () => {
      const rpcError = {
        code: HTTP_ERROR_CODE.BAD_REQUEST,
        message: 'common.erros.validationError',
      };
      const mockDto = { ...mockAddProductCartRequest };

      mockPlainToInstance.mockReturnValue(mockDto);
      mockValidateOrReject.mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await service.addProductCart(mockAddProductCartRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).message).toEqual(rpcError.message);
      }
      expect(mockPrismaService.client.cart.upsert).not.toHaveBeenCalled();
    });
    it('should handle PrismaClient error', async () => {
      const rpcError = {
        code: HTTP_ERROR_CODE.CONFLICT,
        message: 'common.errors.prismaClientError',
      };
      const mockDto = { ...mockAddProductCartRequest };

      mockPlainToInstance.mockReturnValue(mockDto);
      mockValidateOrReject.mockResolvedValue(undefined);
      (mockPrismaService.client.cart.upsert as jest.Mock).mockRejectedValue(
        new Error('PrismaClient error'),
      );

      try {
        await service.addProductCart(mockAddProductCartRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).message).toEqual(rpcError.message);
      }
    });
  });
});
