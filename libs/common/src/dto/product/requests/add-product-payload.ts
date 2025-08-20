import { IsInt } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class AddProductPayload {
  @IsInt({
    message: i18nValidationMessage('common.validation.isInt', {
      field: 'productVariantId',
    }),
  })
  productVariantId: number;
  @IsInt({
    message: i18nValidationMessage('common.validation.isInt', {
      field: 'quantity',
    }),
  })
  quantity: number;
}
