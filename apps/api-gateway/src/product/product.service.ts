import { PRODUCT_SERVICE } from '@app/common';
import { CloudinaryService } from '@app/common/cloudinary/cloudinary.service';
import { RETRIES_DEFAULT, TIMEOUT_MS_DEFAULT } from '@app/common/constant/rpc.constants';
import { ProductDto } from '@app/common/dto/product/product.dto';
import { ProductResponse } from '@app/common/dto/product/response/product-response';
import { ProductPattern } from '@app/common/enums/message-patterns/product.pattern';
import { StatusKey } from '@app/common/enums/status-key.enum';
import { callMicroservice } from '@app/common/helpers/microservices';
import { BaseResponse } from '@app/common/interfaces/data-type';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { buildBaseResponse } from '@app/common/utils/data.util';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class ProductService {
  constructor(
    @Inject(PRODUCT_SERVICE) private readonly productClient: ClientProxy,
    private readonly loggerService: CustomLogger,
    private readonly i18nService: I18nService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(
    input: ProductDto,
    files: Array<Express.Multer.File>,
  ): Promise<BaseResponse<ProductResponse>> {
    const productExists = await callMicroservice<BaseResponse<ProductResponse>>(
      this.productClient.send(ProductPattern.CHECK_PRODUCT_EXISTS, input.skuId),
      PRODUCT_SERVICE,
      this.loggerService,
      {
        timeoutMs: TIMEOUT_MS_DEFAULT,
        retries: RETRIES_DEFAULT,
      },
    );

    if (productExists) {
      throw new BadRequestException(
        this.i18nService.translate('common.product.error.productExists'),
      );
    }

    if (!files || files.length === 0) {
      throw new BadRequestException(this.i18nService.translate('common.product.error.filesExists'));
    }

    const imagesUrl = await this.cloudinaryService.uploadImagesToCloudinary(files);

    const create = await callMicroservice<ProductResponse>(
      this.productClient.send(ProductPattern.CREATE_PRODUCT, {
        productData: input,
        secureUrl: imagesUrl,
      }),
      PRODUCT_SERVICE,
      this.loggerService,
      {
        timeoutMs: TIMEOUT_MS_DEFAULT,
        retries: RETRIES_DEFAULT,
      },
    );
    if (!create) {
      throw new BadRequestException(this.i18nService.translate('common.product.error.failed'));
    }
    return buildBaseResponse<ProductResponse>(StatusKey.SUCCESS, create);
  }
}
