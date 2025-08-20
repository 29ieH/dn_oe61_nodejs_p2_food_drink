import { UserStatus } from '@app/common/enums/user-status.enum';
import { StatusUser } from 'apps/user-service/generated/prisma';
import { Transform, Type } from 'class-transformer';
import { ArrayNotEmpty, IsEnum, IsInt, ValidateNested } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class UserUpdateStatusItem {
  @IsInt({
    message: i18nValidationMessage('common.validation.isInt', {
      field: 'userId',
    }),
  })
  userId: number;
  @Transform(({ value }) => {
    if (!value) return undefined;
    return String(value).toUpperCase();
  })
  @IsEnum(UserStatus, {
    message: i18nValidationMessage('common.validation.isEnum', {
      field: 'status',
      enum: [UserStatus.ACTIVE, UserStatus.INACTIVE],
    }),
  })
  status: StatusUser;
}

export class UserUpdateStatusRequest {
  @ArrayNotEmpty({
    message: i18nValidationMessage('common.validation.arrayNotEmpty', {
      field: 'users',
    }),
  })
  @ValidateNested({ each: true })
  @Type(() => UserUpdateStatusItem)
  users: UserUpdateStatusItem[];
}
