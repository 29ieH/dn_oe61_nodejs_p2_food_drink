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
});
