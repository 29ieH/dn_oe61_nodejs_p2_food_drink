import { Role } from '@app/common/enums/roles/users.enum';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, ValidateNested, ArrayNotEmpty } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class UserUpdateRoleItem {
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
  @IsEnum(Role, {
    message: i18nValidationMessage('common.validation.isEnum', {
      field: 'role',
      enum: [Role.ADMIN, Role.USER],
    }),
  })
  role: Role;
}

export class UserUpdateRoleRequest {
  @ArrayNotEmpty({
    message: i18nValidationMessage('common.validation.arrayNotEmpty', {
      field: 'users',
    }),
  })
  @ValidateNested({ each: true })
  @Type(() => UserUpdateRoleItem)
  users: UserUpdateRoleItem[];
}
