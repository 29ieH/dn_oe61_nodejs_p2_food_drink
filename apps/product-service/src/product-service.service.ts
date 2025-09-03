import { CreateProductDto } from '@app/common/dto/product/create-product.dto';
import { AddProductCartRequest } from '@app/common/dto/product/requests/add-product-cart.request';
import { DeleteProductCartRequest } from '@app/common/dto/product/requests/delete-product-cart.request';
import { DeleteSoftCartRequest } from '@app/common/dto/product/requests/delete-soft-cart.request';
import { CartSummaryResponse } from '@app/common/dto/product/response/cart-summary.response';
import { ProductResponse } from '@app/common/dto/product/response/product-response';
import { HTTP_ERROR_CODE } from '@app/common/enums/errors/http-error-code';
import { StatusKey } from '@app/common/enums/status-key.enum';
import { TypedRpcException } from '@app/common/exceptions/rpc-exceptions';
import { BaseResponse } from '@app/common/interfaces/data-type';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { buildBaseResponse } from '@app/common/utils/data.util';
import { handlePrismaError } from '@app/common/utils/prisma-client-error';
import { PrismaService } from '@app/prisma';
import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { Cart, CartItem, PrismaClient, ProductVariant } from '../generated/prisma';

@Injectable()
export class ProductService {
  constructor(
    private readonly prismaService: PrismaService<PrismaClient>,
    private readonly loggerService: CustomLogger,
  ) {}
  async checkProductExists(skuId: string): Promise<ProductResponse | null> {
    const product = await this.prismaService.client.product.findUnique({
      where: { skuId },
    });

    if (!product) return null;
    return {
      id: product.id,
      name: product.name,
      skuId: product.skuId,
      description: product.description,
      status: product.status,
      basePrice: product.basePrice,
      quantity: product.quantity,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    } as ProductResponse;
  }
  async createProduct(data: CreateProductDto): Promise<ProductResponse | null> {
    const dto = plainToInstance(CreateProductDto, data);
    await validateOrReject(dto);

    const { productData, secureUrl } = data;
    const query = await this.prismaService.client.$transaction(async (prisma) => {
      const product = await prisma.product.create({
        data: {
          skuId: productData.skuId,
          name: productData.name,
          description: productData.description,
          status: productData.status,
          basePrice: productData.basePrice,
          quantity: productData.quantity,
        },
      });

      const imagePromises = secureUrl.map((url) =>
        prisma.productImage.create({
          data: {
            url,
            productId: product.id,
          },
        }),
      );
      await Promise.all(imagePromises);

      const variantPromises = productData.variants.map((variant) =>
        prisma.productVariant.create({
          data: {
            price: variant.price,
            startDate: new Date(variant.startDate),
            endDate: variant.endDate ? new Date(variant.endDate) : null,
            productId: product.id,
            sizeId: variant.sizeId,
          },
        }),
      );
      await Promise.all(variantPromises);

      const categoryPromises = productData.categoryIds.map((categoryId) =>
        prisma.categoryProduct.create({
          data: {
            categoryId,
            productId: product.id,
          },
        }),
      );
      await Promise.all(categoryPromises);
      return product;
    });

    const result = {
      id: query.id,
      skuId: query.skuId,
      name: query.name,
      description: query.description,
      status: query.status,
      basePrice: new Decimal(query.basePrice),
      quantity: query.quantity,
      createdAt: query.createdAt,
      updatedAt: query.updatedAt,
    } as ProductResponse;

    return result;
  }
  async deleteSoftCart(dto: DeleteSoftCartRequest): Promise<void> {
    try {
      const cartByUser = await this.prismaService.client.cart.findUnique({
        where: {
          userId: dto.userId,
        },
      });
      if (cartByUser) {
        await this.prismaService.client.cart.update({
          where: {
            userId: dto.userId,
          },
          data: {
            deletedAt: new Date(),
          },
        });
      }
    } catch (error) {
      return handlePrismaError(error, ProductService.name, 'deleteSoftCart', this.loggerService);
    }
  }
  async addProductCart(dto: AddProductCartRequest): Promise<BaseResponse<CartSummaryResponse>> {
    try {
      const payload = plainToInstance(AddProductCartRequest, dto);
      await validateOrReject(payload);
      const cart = await this.prismaService.client.cart.upsert({
        where: { userId: dto.userId },
        create: { userId: dto.userId },
        update: {},
      });
      const productVariant = await this.prismaService.client.productVariant.findUnique({
        where: { id: dto.productVariantId },
        select: {
          id: true,
          price: true,
          product: { select: { quantity: true } },
        },
      });
      if (!productVariant) {
        throw new TypedRpcException({
          code: HTTP_ERROR_CODE.NOT_FOUND,
          message: 'common.product.notFound',
        });
      }
      const existingItem = await this.prismaService.client.cartItem.findUnique({
        where: {
          cartId_productVariantId: {
            cartId: cart.id,
            productVariantId: dto.productVariantId,
          },
        },
      });
      const currentQuantityInCart = existingItem ? existingItem.quantity : 0;
      if (dto.quantity + currentQuantityInCart > productVariant.product.quantity) {
        throw new TypedRpcException({
          code: HTTP_ERROR_CODE.BAD_REQUEST,
          message: 'common.product.quantityNotEnough',
        });
      }
      if (existingItem) {
        await this.prismaService.client.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: existingItem.quantity + dto.quantity },
        });
      } else {
        await this.prismaService.client.cartItem.create({
          data: {
            quantity: dto.quantity,
            cartId: cart.id,
            productVariantId: dto.productVariantId,
          },
        });
      }
      const cartSummary = await this.prismaService.client.cart.findUniqueOrThrow({
        where: { id: cart.id },
        include: {
          items: {
            include: {
              productVariant: { select: { id: true, price: true } },
            },
          },
        },
      });
      return buildBaseResponse(StatusKey.SUCCESS, this.toCartSummaryResponse(cartSummary));
    } catch (error) {
      if (error instanceof TypedRpcException) {
        throw error;
      }
      return handlePrismaError(error, ProductService.name, 'addProductCart', this.loggerService);
    }
  }
  async deleteProductCart(
    dto: DeleteProductCartRequest,
  ): Promise<BaseResponse<CartSummaryResponse>> {
    try {
      const payload = plainToInstance(DeleteProductCartRequest, dto);
      await validateOrReject(payload);
      const cartDetail = await this.prismaService.client.cart.findUnique({
        where: {
          userId: dto.userId,
        },
      });
      if (!cartDetail) {
        throw new TypedRpcException({
          code: HTTP_ERROR_CODE.NOT_FOUND,
          message: 'common.cart.notFound',
        });
      }
      const productVariants = await this.prismaService.client.productVariant.findMany({
        where: { id: { in: dto.productVariantIds } },
        select: { id: true },
      });
      const existingIds = productVariants.map((v) => v.id);
      if (existingIds.length !== dto.productVariantIds.length) {
        const notFoundProductVariantIds = dto.productVariantIds.filter(
          (id) => !existingIds.includes(id),
        );
        if (notFoundProductVariantIds.length > 0) {
          throw new TypedRpcException({
            code: HTTP_ERROR_CODE.NOT_FOUND,
            message: 'common.product.someProductNotExist',
            args: {
              missingIds: notFoundProductVariantIds.join(', '),
            },
          });
        }
      }
      await this.prismaService.client.cartItem.deleteMany({
        where: {
          cartId: cartDetail.id,
          productVariantId: { in: dto.productVariantIds },
        },
      });
      const cartSummary = await this.prismaService.client.cart.findUniqueOrThrow({
        where: { id: cartDetail.id },
        include: {
          items: {
            include: {
              productVariant: { select: { id: true, price: true } },
            },
          },
        },
      });
      return buildBaseResponse(StatusKey.SUCCESS, this.toCartSummaryResponse(cartSummary));
    } catch (error) {
      if (error instanceof TypedRpcException) {
        throw error;
      }
      return handlePrismaError(error, ProductService.name, 'addProductCart', this.loggerService);
    }
  }
  private toCartSummaryResponse(
    cartSummary: Cart & { items: (CartItem & { productVariant: ProductVariant })[] },
  ): CartSummaryResponse {
    return {
      cartId: cartSummary.id,
      userId: cartSummary.userId,
      cartItems: cartSummary.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        productVariant: {
          id: item.productVariant.id,
          price: Number(item.productVariant.price),
        },
      })),
      totalQuantity: cartSummary.items.reduce((total, item) => total + item.quantity, 0),
      totalAmount: cartSummary.items.reduce(
        (total, item) => total + item.quantity * Number(item.productVariant.price),
        0,
      ),
    };
  }
}
