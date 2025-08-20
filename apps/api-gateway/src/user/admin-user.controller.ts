import { AuthRoles } from '@app/common/decorators/auth-role.decorator';
import { UserCreationRequest } from '@app/common/dto/user/requests/user-creation.request';
import { UserUpdateRoleRequest } from '@app/common/dto/user/requests/user-update-role.request';
import { UserUpdateStatusRequest } from '@app/common/dto/user/requests/user-update-status.request';
import { HTTP_ERROR_CODE } from '@app/common/enums/errors/http-error-code';
import { Role } from '@app/common/enums/roles/users.enum';
import { TypedRpcException } from '@app/common/exceptions/rpc-exceptions';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { isRpcError } from '@app/common/utils/error.util';
import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadApiResponse } from 'cloudinary';
import { CloudinaryService } from 'libs/cloudinary/cloudinary.service';
import { multerConfig } from 'libs/cloudinary/multer.config';
import { UserService } from './user.service';
import { SoftDeleteUserRequest } from '@app/common/dto/user/requests/soft-delete-user.request';
import { Public } from '@app/common/decorators/metadata.decorator';

@Controller('/admin/user')
export class AdminUserController {
  constructor(
    private readonly userService: UserService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly loggerService: CustomLogger,
  ) {}
  @UseInterceptors(FileInterceptor('image', multerConfig))
  @AuthRoles(Role.ADMIN)
  @Post('')
  async create(@UploadedFile() file: Express.Multer.File, @Body() dto: UserCreationRequest) {
    let uploadImage: UploadApiResponse | null = null;
    try {
      uploadImage = await this.cloudinaryService.uploadImage(file);
      dto.imageUrl = uploadImage.secure_url;
      return await this.userService.create(dto);
    } catch (error) {
      this.loggerService.error(`[ADMIN CREATE USER ERROR]`, `Details:: ${(error as Error).stack}`);
      if (uploadImage) {
        await this.cloudinaryService.deleteImage(uploadImage.public_id);
      }
      if (isRpcError(error)) {
        throw error;
      }
      throw new TypedRpcException({
        code: HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        message: 'common.user.action.create.error',
      });
    }
  }
  @AuthRoles(Role.ADMIN)
  @Patch('roles')
  async updateRoles(@Body() dto: UserUpdateRoleRequest) {
    return await this.userService.updateRoles(dto);
  }
  @AuthRoles(Role.ADMIN)
  @Patch('status')
  async updateStatuses(@Body() dto: UserUpdateStatusRequest) {
    return await this.userService.updateStatuses(dto);
  }
  // @AuthRoles(Role.ADMIN)
  @Public()
  @Delete('/:id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    const payload: SoftDeleteUserRequest = {
      userId: id,
    };
    return await this.userService.delete(payload);
  }
}
