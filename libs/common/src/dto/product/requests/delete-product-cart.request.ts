import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, IsNotEmpty } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class DeleteProductCartRequest {
  @IsNotEmpty({
    message: i18nValidationMessage('common.validation.isNotEmpty', {
      field: 'userId',
    }),
  })
  @IsInt({
    message: i18nValidationMessage('common.validation.isInt', {
      field: 'userId',
    }),
  })
  userId: number;
  @IsArray()
  @ArrayNotEmpty({
    message: i18nValidationMessage('common.validation.arrayNotEmpty', {
      field: 'productVariantIds',
    }),
  })
  @Type(() => Number)
  @IsInt({
    each: true,
    message: i18nValidationMessage('common.validation.isInt', {
      field: 'productVariantId',
    }),
  })
  productVariantIds: number[];
}
