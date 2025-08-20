import { UserCreationRequest } from '@app/common/dto/user/requests/user-creation.request';
import { UserUpdateRoleRequest } from '@app/common/dto/user/requests/user-update-role.request';
import { UserSummaryResponse } from '@app/common/dto/user/responses/user-summary.response';
import { HTTP_ERROR_CODE } from '@app/common/enums/errors/http-error-code';
import { Role } from '@app/common/enums/roles/users.enum';
import { StatusKey } from '@app/common/enums/status-key.enum';
import { TypedRpcException } from '@app/common/exceptions/rpc-exceptions';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { buildBaseResponse } from '@app/common/utils/data.util';
import { BadRequestException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Test, TestingModule } from '@nestjs/testing';
import { UploadApiResponse } from 'cloudinary';
import { CloudinaryService } from 'libs/cloudinary/cloudinary.service';
import { AdminUserController } from '../src/user/admin-user.controller';
import { UserService } from '../src/user/user.service';
import { UserStatus } from '@app/common/enums/user-status.enum';
import { UserUpdateStatusRequest } from '@app/common/dto/user/requests/user-update-status.request';
import { BaseResponse } from '@app/common/interfaces/data-type';
import { SoftDeleteUserResponse } from '@app/common/dto/user/responses/soft-delete-user.response';

function createMockCloudinaryService(): jest.Mocked<CloudinaryService> {
  return {
    uploadImage: jest.fn(),
    deleteImage: jest.fn(),
  } as unknown as jest.Mocked<CloudinaryService>;
}

function createMockUserService(): jest.Mocked<UserService> {
  return {
    create: jest.fn(),
    updateRoles: jest.fn(),
    updateStatuses: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<UserService>;
}

function createMockLogger(): jest.Mocked<CustomLogger> {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  } as unknown as jest.Mocked<CustomLogger>;
}

describe('AdminUserController', () => {
  let controller: AdminUserController;
  let cloudinaryService: jest.Mocked<CloudinaryService>;
  let userService: jest.Mocked<UserService>;
  let logger: jest.Mocked<CustomLogger>;

  beforeEach(async () => {
    cloudinaryService = createMockCloudinaryService();
    userService = createMockUserService();
    logger = createMockLogger();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUserController],
      providers: [
        { provide: CloudinaryService, useValue: cloudinaryService },
        { provide: UserService, useValue: userService },
        { provide: CustomLogger, useValue: logger },
        { provide: I18nService, useValue: { translate: jest.fn() } },
      ],
    }).compile();

    controller = module.get(AdminUserController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
  const uploadResponse = {
    asset_id: 'asset',
    public_id: 'public',
    secure_url: 'http://cloudinary/test.png',
    version: 1,
    version_id: 'vid',
    signature: 'sig',
    width: 100,
    height: 100,
    format: 'png',
    resource_type: 'image',
    created_at: new Date().toISOString(),
    tags: [],
    bytes: 123,
    type: 'upload',
    etag: 'etag',
    placeholder: false,
    url: 'http://cloudinary/test.png',
    original_filename: 'test',
  } as unknown as UploadApiResponse;
  describe('Create user', () => {
    it('should create user successfully', async () => {
      const fileMock = { originalname: 'test.png' } as Express.Multer.File;
      const dto: UserCreationRequest = {
        name: 'John Doe',
        role: 'USER',
      } as unknown as UserCreationRequest;
      const userResponse = {
        id: 1,
        name: 'John Doe',
        role: 'USER',
        userName: 'doe@123',
        email: 'test@mail.com',
        address: '123 Main St',
        dateOfBirth: new Date(),
        phone: '123456789',
        imageUrl: 'http://cloudinary/test.png',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const createdUserResponse = buildBaseResponse(StatusKey.SUCCESS, userResponse);

      const cloudinaryServiceSpy = jest
        .spyOn(cloudinaryService, 'uploadImage')
        .mockResolvedValue(uploadResponse);
      const userServiceSpy = jest
        .spyOn(userService, 'create')
        .mockResolvedValue(createdUserResponse);
      const result = await controller.create(fileMock, dto);
      expect(cloudinaryServiceSpy).toHaveBeenCalledWith(fileMock);
      expect(userServiceSpy).toHaveBeenCalledWith({ ...dto, imageUrl: uploadResponse.secure_url });
      expect(result).toEqual(createdUserResponse);
    });

    it('should delete image and throw TypedRpcException when service fails', async () => {
      const fileMock = { originalname: 'test.png' } as Express.Multer.File;
      const dto: UserCreationRequest = {
        name: 'John Doe',
        role: 'USER',
      } as unknown as UserCreationRequest;
      const cloudinaryUploadSpy = jest
        .spyOn(cloudinaryService, 'uploadImage')
        .mockResolvedValue(uploadResponse);
      const userServiceSpy = jest.spyOn(userService, 'create').mockRejectedValue(
        new TypedRpcException({
          code: HTTP_ERROR_CODE.CONFLICT,
          message: 'common.user.phoneNumberExist',
        }),
      );
      const deleteSpy = jest.spyOn(cloudinaryService, 'deleteImage');
      const loggerSpy = jest.spyOn(logger, 'error');
      await expect(controller.create(fileMock, dto)).rejects.toEqual(
        new TypedRpcException({
          code: HTTP_ERROR_CODE.CONFLICT,
          message: 'common.user.phoneNumberExist',
        }),
      );
      expect(cloudinaryUploadSpy).toHaveBeenCalledWith(fileMock);
      expect(userServiceSpy).toHaveBeenCalledWith({
        ...dto,
        imageUrl: uploadResponse.secure_url,
      });
      expect(deleteSpy).toHaveBeenCalledWith(uploadResponse.public_id);
      expect(loggerSpy).toHaveBeenCalled();
    });
  });
  describe('Update roles', () => {
    it('should update roles successfully', async () => {
      const request: UserUpdateRoleRequest = {
        users: [
          { userId: 2, role: Role.ADMIN },
          { userId: 3, role: Role.USER },
        ],
      };
      const responseMock: UserSummaryResponse[] = [
        {
          id: 2,
          name: 'Thái Trung',
          userName: 'trung1',
          email: 'thaitrung2',
          isActive: false,
          imageUrl: null,
          status: UserStatus.ACTIVE.toString(),
          role: 'ADMIN',
        },
        {
          id: 3,
          name: 'Thái Văn',
          userName: 'van1',
          email: 'thaivan2',
          isActive: false,
          imageUrl: null,
          status: UserStatus.ACTIVE.toString(),
          role: 'USER',
        },
      ];
      const response = buildBaseResponse(StatusKey.SUCCESS, responseMock);
      const userServiceSpy = jest.spyOn(userService, 'updateRoles').mockResolvedValue(response);

      const result = await controller.updateRoles(request);

      expect(userServiceSpy).toHaveBeenCalledWith(request);
      expect(result).toEqual(response);
    });
    it('should proparte BadRequestException when validator errors', async () => {
      const request: UserUpdateRoleRequest = {
        users: [
          { userId: 2, role: 13 as unknown as Role },
          { userId: 3, role: 13 as unknown as Role },
        ],
      };
      const error = new BadRequestException('Validation Error');
      const userServiceSpy = jest.spyOn(userService, 'updateRoles').mockRejectedValue(error);
      await expect(controller.updateRoles(request)).rejects.toThrow(BadRequestException);
      expect(userServiceSpy).toHaveBeenCalledWith(request);
    });
    it('should return unchanged status if there are no updates', async () => {
      const request: UserUpdateRoleRequest = {
        users: [
          { userId: 2, role: Role.ADMIN },
          { userId: 3, role: Role.USER },
        ],
      };
      const response = buildBaseResponse(StatusKey.UNCHANGED, []);
      const userServiceSpy = jest.spyOn(userService, 'updateRoles').mockResolvedValue(response);
      const result = await controller.updateRoles(request);
      expect(userServiceSpy).toHaveBeenCalledWith(request);
      expect(result).toEqual(response);
    });
    it('should proparte TypedRpcException when create user fails', async () => {
      const request: UserUpdateRoleRequest = {
        users: [
          { userId: 2, role: Role.ADMIN },
          { userId: 3, role: Role.USER },
        ],
      };
      const rpcError = {
        code: HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        message: 'common.user.action.create.error',
      };
      const userServiceSpy = jest
        .spyOn(userService, 'updateRoles')
        .mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await controller.updateRoles(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(
          HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        );
      }
      expect(userServiceSpy).toHaveBeenCalledWith(request);
    });
    it('should proparte TypedRpcException when service fails', async () => {
      const request: UserUpdateRoleRequest = {
        users: [
          { userId: 2, role: Role.ADMIN },
          { userId: 3, role: Role.USER },
        ],
      };
      const rpcError = {
        code: HTTP_ERROR_CODE.CONFLICT,
        message: 'common.errors.foreignKeyConstraint',
      };
      const userServiceSpy = jest
        .spyOn(userService, 'updateRoles')
        .mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await controller.updateRoles(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.CONFLICT);
      }
      expect(userServiceSpy).toHaveBeenCalledWith(request);
    });
    it('should proparte TypedRpcException when service fails with logic', async () => {
      const request: UserUpdateRoleRequest = {
        users: [
          { userId: 2, role: Role.ADMIN },
          { userId: 3, role: Role.USER },
        ],
      };
      const rpcError = {
        code: HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        message: 'common.errors.internalServerError',
      };
      const userServiceSpy = jest
        .spyOn(userService, 'updateRoles')
        .mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await controller.updateRoles(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(
          HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        );
      }
      expect(userServiceSpy).toHaveBeenCalledWith(request);
    });
    it('should proparte TypedRpcException when service fails with some users not found', async () => {
      const request: UserUpdateRoleRequest = {
        users: [
          { userId: 2, role: Role.ADMIN },
          { userId: 3, role: Role.USER },
        ],
      };
      const rpcError = {
        code: HTTP_ERROR_CODE.NOT_FOUND,
        message: 'common.errors.someUserNotExist',
      };
      const userServiceSpy = jest
        .spyOn(userService, 'updateRoles')
        .mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await controller.updateRoles(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.NOT_FOUND);
      }
      expect(userServiceSpy).toHaveBeenCalledWith(request);
    });
  });
  describe('Update statuses', () => {
    it('should update statuses successfully', async () => {
      const request: UserUpdateStatusRequest = {
        users: [
          { userId: 2, status: UserStatus.ACTIVE },
          { userId: 3, status: UserStatus.INACTIVE },
        ],
      };
      const responseMock: UserSummaryResponse[] = [
        {
          id: 2,
          name: 'Thái Trung',
          userName: 'trung1',
          email: 'thaitrung2',
          isActive: true,
          imageUrl: null,
          status: UserStatus.ACTIVE.toString(),
          role: 'ADMIN',
        },
        {
          id: 3,
          name: 'Thái Văn',
          userName: 'van1',
          email: 'thaivan2',
          isActive: false,
          imageUrl: null,
          status: UserStatus.INACTIVE.toString(),
          role: 'USER',
        },
      ];
      const response = buildBaseResponse(StatusKey.SUCCESS, responseMock);
      const userServiceSpy = jest.spyOn(userService, 'updateStatuses').mockResolvedValue(response);

      const result = await controller.updateStatuses(request);

      expect(userServiceSpy).toHaveBeenCalledWith(request);
      expect(result).toEqual(response);
    });
    it('should return unchanged status if there are no updates', async () => {
      const request: UserUpdateStatusRequest = {
        users: [
          { userId: 2, status: UserStatus.ACTIVE },
          { userId: 3, status: UserStatus.ACTIVE },
        ],
      };
      const response = buildBaseResponse(StatusKey.UNCHANGED, []);
      const userServiceSpy = jest.spyOn(userService, 'updateStatuses').mockResolvedValue(response);

      const result = await controller.updateStatuses(request);

      expect(userServiceSpy).toHaveBeenCalledWith(request);
      expect(result).toEqual(response);
    });
    it('should propagate BadRequestException when validator errors', async () => {
      const request = {
        users: [
          { userId: 2, status: 13 as unknown as UserStatus },
          { userId: 3, status: 13 as unknown as UserStatus },
        ],
      };
      const error = new BadRequestException('Validation Error');
      const userServiceSpy = jest.spyOn(userService, 'updateStatuses').mockRejectedValue(error);

      await expect(controller.updateStatuses(request)).rejects.toThrow(BadRequestException);
      expect(userServiceSpy).toHaveBeenCalledWith(request);
    });
    it('should propagate TypedRpcException when update fails', async () => {
      const request: UserUpdateStatusRequest = {
        users: [
          { userId: 2, status: UserStatus.ACTIVE },
          { userId: 3, status: UserStatus.INACTIVE },
        ],
      };
      const rpcError = {
        code: HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        message: 'common.user.action.update.error',
      };
      const userServiceSpy = jest
        .spyOn(userService, 'updateStatuses')
        .mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await controller.updateStatuses(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(
          HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        );
      }
      expect(userServiceSpy).toHaveBeenCalledWith(request);
    });
    it('should propagate TypedRpcException when service fails', async () => {
      const request: UserUpdateStatusRequest = {
        users: [
          { userId: 2, status: UserStatus.ACTIVE },
          { userId: 3, status: UserStatus.INACTIVE },
        ],
      };
      const rpcError = {
        code: HTTP_ERROR_CODE.CONFLICT,
        message: 'common.errors.rowNotFound',
      };
      const userServiceSpy = jest
        .spyOn(userService, 'updateStatuses')
        .mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await controller.updateStatuses(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.CONFLICT);
      }
      expect(userServiceSpy).toHaveBeenCalledWith(request);
    });
    it('should propagate TypedRpcException when service fails with logic', async () => {
      const request: UserUpdateStatusRequest = {
        users: [
          { userId: 2, status: UserStatus.ACTIVE },
          { userId: 3, status: UserStatus.INACTIVE },
        ],
      };
      const rpcError = {
        code: HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        message: 'common.errors.internalServerError',
      };
      const userServiceSpy = jest
        .spyOn(userService, 'updateStatuses')
        .mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await controller.updateStatuses(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(
          HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        );
      }
      expect(userServiceSpy).toHaveBeenCalledWith(request);
    });
    it('should propagate TypedRpcException when service fails with some users not found', async () => {
      const request: UserUpdateStatusRequest = {
        users: [
          { userId: 2, status: UserStatus.ACTIVE },
          { userId: 3, status: UserStatus.INACTIVE },
        ],
      };
      const rpcError = {
        code: HTTP_ERROR_CODE.NOT_FOUND,
        message: 'common.errors.someUserNotExist',
      };
      const userServiceSpy = jest
        .spyOn(userService, 'updateStatuses')
        .mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await controller.updateStatuses(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.NOT_FOUND);
      }
      expect(userServiceSpy).toHaveBeenCalledWith(request);
    });
  });
  describe('Delete user', () => {
    it('should delete user successfully', async () => {
      const id = 10;
      const deleteResponse = buildBaseResponse(StatusKey.SUCCESS, {
        userId: id,
        deletedAt: new Date(),
      });
      const userServiceSpy = jest.spyOn(userService, 'delete').mockResolvedValue(deleteResponse);
      const result = await controller.delete(id);
      expect(userServiceSpy).toHaveBeenCalledWith({ userId: id });
      expect(result).toEqual(deleteResponse);
    });
    it('should return unchanged when user already deleted', async () => {
      const id = 11;
      const unchangedResponse = buildBaseResponse(
        StatusKey.UNCHANGED,
      ) as unknown as BaseResponse<SoftDeleteUserResponse>;
      const userServiceSpy = jest.spyOn(userService, 'delete').mockResolvedValue(unchangedResponse);
      const result = await controller.delete(id);
      expect(userServiceSpy).toHaveBeenCalledWith({ userId: id });
      expect(result).toEqual(unchangedResponse);
    });

    it('should propagate TypedRpcException when service fails', async () => {
      const id = 12;
      const rpcError = {
        code: HTTP_ERROR_CODE.NOT_FOUND,
        message: 'common.user.notFound',
      } as const;
      const userServiceSpy = jest
        .spyOn(userService, 'delete')
        .mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await controller.delete(id);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.NOT_FOUND);
      }
      expect(userServiceSpy).toHaveBeenCalledWith({ userId: id });
    });
  });
});
