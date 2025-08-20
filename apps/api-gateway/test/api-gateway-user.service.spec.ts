import { UserCreationRequest } from '@app/common/dto/user/requests/user-creation.request';
import { UserUpdateRoleRequest } from '@app/common/dto/user/requests/user-update-role.request';
import { UserCreationResponse } from '@app/common/dto/user/responses/user-creation.response';
import { UserSummaryResponse } from '@app/common/dto/user/responses/user-summary.response';
import { HTTP_ERROR_CODE } from '@app/common/enums/errors/http-error-code';
import { RoleEnum } from '@app/common/enums/role.enum';
import { Role } from '@app/common/enums/roles/users.enum';
import { StatusKey } from '@app/common/enums/status-key.enum';
import { TypedRpcException } from '@app/common/exceptions/rpc-exceptions';
import { callMicroservice as callMicroserviceHelper } from '@app/common/helpers/microservices';
import { BaseResponse } from '@app/common/interfaces/data-type';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { buildBaseResponse } from '@app/common/utils/data.util';
import { ClientProxy } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { validateOrReject } from 'class-validator';
import { Observable } from 'rxjs';
import { UserService } from '../src/user/user.service';
import { UserStatus } from '@app/common/enums/user-status.enum';
import { UserUpdateStatusRequest } from '@app/common/dto/user/requests/user-update-status.request';
import { SoftDeleteUserRequest } from '@app/common/dto/user/requests/soft-delete-user.request';
import { SoftDeleteUserResponse } from '@app/common/dto/user/responses/soft-delete-user.response';

jest.mock('@app/common/helpers/microservices');
jest.mock('class-validator', () => {
  const actual = jest.requireActual<typeof import('class-validator')>('class-validator');
  return {
    ...actual,
    validateOrReject: jest.fn().mockResolvedValue(undefined),
  };
});
function createMockClientProxy(): jest.Mocked<ClientProxy> {
  return {
    send: jest.fn(),
  } as unknown as jest.Mocked<ClientProxy>;
}

function createMockLogger(): jest.Mocked<CustomLogger> {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  } as unknown as jest.Mocked<CustomLogger>;
}

describe('UserService', () => {
  let service: UserService;
  let clientProxy: jest.Mocked<ClientProxy>;
  let logger: jest.Mocked<CustomLogger>;

  beforeEach(async () => {
    clientProxy = createMockClientProxy();
    logger = createMockLogger();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: 'user-service', useValue: clientProxy },
        { provide: CustomLogger, useValue: logger },
      ],
    }).compile();
    service = module.get(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
  describe('createUser', () => {
    it('should validate dto, send message and return response', async () => {
      const dto: UserCreationRequest = {
        name: 'John',
        email: 'john@mail.com',
        password: 'password123',
        role: RoleEnum.USER,
      } as UserCreationRequest;

      const microserviceResponse: BaseResponse<UserCreationResponse> = {
        statusKey: StatusKey.SUCCESS,
        data: {
          id: 1,
          name: 'John',
          userName: 'john123',
          email: 'john@mail.com',
          imageUrl: null,
          phone: null,
          address: null,
          dateOfBirth: null,
          role: 'USER',
          createdAt: new Date(),
        },
      } as BaseResponse<UserCreationResponse>;
      (callMicroserviceHelper as jest.Mock).mockResolvedValue(microserviceResponse);
      const clientProxySpy = clientProxy.send.mockReturnValue(
        {} as unknown as Observable<BaseResponse<UserCreationResponse>>,
      );
      const result = await service.create(dto);
      expect(validateOrReject).toHaveBeenCalled();
      expect(clientProxySpy).toHaveBeenCalled();
      expect(callMicroserviceHelper).toHaveBeenCalled();
      expect(result).toEqual(microserviceResponse);
    });
    it('should propagate phoneNumberExist error from microservice', async () => {
      const dto: UserCreationRequest = {
        name: 'John',
        email: 'john@mail.com',
        password: 'password123',
        role: RoleEnum.USER,
        phone: '0938123123',
      } as UserCreationRequest;
      const rpcError = {
        code: HTTP_ERROR_CODE.CONFLICT,
        message: 'common.user.phoneNumberExist',
      };
      (callMicroserviceHelper as jest.Mock).mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await service.create(dto);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.CONFLICT);
      }
    });
    it('should propagate emailExist error from microservice', async () => {
      const dto: UserCreationRequest = {
        name: 'John',
        email: 'john@mail.com',
        password: 'password123',
        role: RoleEnum.USER,
      } as UserCreationRequest;
      const rpcError = {
        code: HTTP_ERROR_CODE.CONFLICT,
        message: 'common.user.emailExist',
      };
      (callMicroserviceHelper as jest.Mock).mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await service.create(dto);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.CONFLICT);
      }
    });
    it('should propagate ConflictError (PrismaClient error) from microservice', async () => {
      const dto: UserCreationRequest = {
        name: 'John',
        email: 'john@mail.com',
        password: 'password123',
        role: RoleEnum.USER,
      } as UserCreationRequest;
      const rpcError = {
        code: HTTP_ERROR_CODE.CONFLICT,
        message: 'common.user.emailExistcommon.errors.uniqueConstraint',
      };
      (callMicroserviceHelper as jest.Mock).mockResolvedValue(new TypedRpcException(rpcError));
      try {
        await service.create(dto);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.CONFLICT);
      }
    });
  });
  describe('updateRoles', () => {
    afterEach(() => {
      (validateOrReject as jest.Mock).mockResolvedValue(undefined);
    });
    it('should validate dto, send message and return response', async () => {
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
      const microserviceResponse = buildBaseResponse(StatusKey.SUCCESS, responseMock);
      const clientProxySpy = clientProxy.send.mockReturnValue(
        {} as unknown as Observable<BaseResponse<UserSummaryResponse[]>>,
      );
      (callMicroserviceHelper as jest.Mock).mockResolvedValue(microserviceResponse);
      const result = await service.updateRoles(request);
      expect(validateOrReject).toHaveBeenCalled();
      expect(clientProxySpy).toHaveBeenCalled();
      expect(callMicroserviceHelper).toHaveBeenCalled();
      expect(result).toEqual(microserviceResponse);
    });
    it('should propagate BadRequestException when validator errors', async () => {
      const request: UserUpdateRoleRequest = { users: [] } as unknown as UserUpdateRoleRequest;
      const rpcError = {
        code: HTTP_ERROR_CODE.BAD_REQUEST,
        message: 'common.errors.validationError',
      };
      (validateOrReject as jest.Mock).mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await service.updateRoles(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.BAD_REQUEST);
      }
    });
    it('should return status unChanged if there is no change in user roles', async () => {
      const request: UserUpdateRoleRequest = {
        users: [{ userId: 1, role: Role.ADMIN }],
      };
      const unchangedResponse: BaseResponse<UserSummaryResponse[] | []> = buildBaseResponse(
        StatusKey.UNCHANGED,
        [],
      );
      (callMicroserviceHelper as jest.Mock).mockResolvedValue(unchangedResponse);
      const result = await service.updateRoles(request);
      expect(result.statusKey).toBe(StatusKey.UNCHANGED);
      expect(result.data).toEqual([]);
    });
    it('should propagate TypedRpcException from microservice when some users not exist', async () => {
      const request: UserUpdateRoleRequest = {
        users: [{ userId: 1, role: Role.ADMIN }],
      } as UserUpdateRoleRequest;
      const rpcError = {
        code: HTTP_ERROR_CODE.NOT_FOUND,
        message: 'common.user.someUserNotExist',
      };
      (callMicroserviceHelper as jest.Mock).mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await service.updateRoles(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.NOT_FOUND);
      }
    });
    it('should propagate TypedRpcException from microservice when some prisma client error', async () => {
      const request: UserUpdateRoleRequest = {
        users: [{ userId: 1, role: Role.ADMIN }],
      } as UserUpdateRoleRequest;
      const rpcError = {
        code: HTTP_ERROR_CODE.CONFLICT,
        message: 'common.errors.uniqueConstraint',
      };
      (callMicroserviceHelper as jest.Mock).mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await service.updateRoles(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.CONFLICT);
      }
    });
    it('should propagate TypedRpcException from microservice when service unavailable', async () => {
      const request: UserUpdateRoleRequest = {
        users: [{ userId: 1, role: Role.ADMIN }],
      } as UserUpdateRoleRequest;
      const rpcError = {
        code: HTTP_ERROR_CODE.SERVICE_UNAVAILABLE,
        message: 'common.errors.unavailableService',
      };
      (callMicroserviceHelper as jest.Mock).mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await service.updateRoles(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(
          HTTP_ERROR_CODE.SERVICE_UNAVAILABLE,
        );
      }
    });
    it('should propagate TypedRpcException from microservice when service fail logic', async () => {
      const request: UserUpdateRoleRequest = {
        users: [{ userId: 1, role: Role.ADMIN }],
      } as UserUpdateRoleRequest;
      const rpcError = {
        code: HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        message: 'common.errors.internalServerError',
      };
      (callMicroserviceHelper as jest.Mock).mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await service.updateRoles(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(
          HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        );
      }
    });
  });
  describe('updateStatuses', () => {
    afterEach(() => {
      (validateOrReject as jest.Mock).mockResolvedValue(undefined);
    });

    it('should validate dto, send message and return response', async () => {
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
          status: UserStatus.INACTIVE.toString(),
          role: 'USER',
        },
      ];
      const microserviceResponse: BaseResponse<UserSummaryResponse[]> = buildBaseResponse(
        StatusKey.SUCCESS,
        responseMock,
      );
      const clientProxySpy = clientProxy.send.mockReturnValue(
        {} as unknown as Observable<BaseResponse<UserSummaryResponse[]>>,
      );
      (callMicroserviceHelper as jest.Mock).mockResolvedValue(microserviceResponse);
      const result = await service.updateStatuses(request);
      expect(validateOrReject).toHaveBeenCalled();
      expect(clientProxySpy).toHaveBeenCalled();
      expect(callMicroserviceHelper).toHaveBeenCalled();
      expect(result).toEqual(microserviceResponse);
    });

    it('should propagate BadRequestException when validator errors', async () => {
      const request: UserUpdateStatusRequest = { users: [] };
      const rpcError = {
        code: HTTP_ERROR_CODE.BAD_REQUEST,
        message: 'common.errors.validationError',
      };
      (validateOrReject as jest.Mock).mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await service.updateStatuses(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.BAD_REQUEST);
      }
    });

    it('should propagate TypedRpcException from microservice when some users not exist', async () => {
      const request: UserUpdateStatusRequest = {
        users: [{ userId: 1, status: UserStatus.INACTIVE }],
      };
      const rpcError = {
        code: HTTP_ERROR_CODE.NOT_FOUND,
        message: 'common.user.someUserNotExist',
      };
      (callMicroserviceHelper as jest.Mock).mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await service.updateStatuses(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.NOT_FOUND);
      }
    });

    it('should propagate TypedRpcException from microservice when some prisma client error', async () => {
      const request: UserUpdateStatusRequest = {
        users: [{ userId: 1, status: UserStatus.INACTIVE }],
      };
      const rpcError = {
        code: HTTP_ERROR_CODE.CONFLICT,
        message: 'common.errors.rowNotFound',
      };
      (callMicroserviceHelper as jest.Mock).mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await service.updateStatuses(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.CONFLICT);
      }
    });

    it('should propagate TypedRpcException from microservice when service unavailable', async () => {
      const request: UserUpdateStatusRequest = {
        users: [{ userId: 1, status: UserStatus.INACTIVE }],
      };
      const rpcError = {
        code: HTTP_ERROR_CODE.SERVICE_UNAVAILABLE,
        message: 'common.errors.unavailableService',
      };
      (callMicroserviceHelper as jest.Mock).mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await service.updateStatuses(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(
          HTTP_ERROR_CODE.SERVICE_UNAVAILABLE,
        );
      }
    });

    it('should propagate TypedRpcException from microservice when service fail logic', async () => {
      const request: UserUpdateStatusRequest = {
        users: [{ userId: 1, status: UserStatus.INACTIVE }],
      };
      const rpcError = {
        code: HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        message: 'common.errors.internalServerError',
      };
      (callMicroserviceHelper as jest.Mock).mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await service.updateStatuses(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(
          HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        );
      }
    });

    it('should return status unChanged if there is no change in user status', async () => {
      const request: UserUpdateStatusRequest = {
        users: [{ userId: 10, status: UserStatus.ACTIVE }],
      };
      const unchangedResponse: BaseResponse<UserSummaryResponse[] | []> = buildBaseResponse(
        StatusKey.UNCHANGED,
        [],
      );
      (callMicroserviceHelper as jest.Mock).mockResolvedValue(unchangedResponse);
      const result = await service.updateStatuses(request);
      expect(result.statusKey).toBe(StatusKey.UNCHANGED);
      expect(result.data).toEqual([]);
    });
  });
  describe('deleteUser', () => {
    afterEach(() => {
      (validateOrReject as jest.Mock).mockResolvedValue(undefined);
    });

    it('should validate dto, send message and return response', async () => {
      const request: SoftDeleteUserRequest = { userId: 5 };
      const responseMock: SoftDeleteUserResponse = {
        userId: 5,
        deletedAt: new Date(),
      } as SoftDeleteUserResponse;
      const microserviceResponse: BaseResponse<SoftDeleteUserResponse> = buildBaseResponse(
        StatusKey.SUCCESS,
        responseMock,
      );
      const clientProxySpy = clientProxy.send.mockReturnValue(
        {} as unknown as Observable<BaseResponse<SoftDeleteUserResponse>>,
      );
      (callMicroserviceHelper as jest.Mock).mockResolvedValue(microserviceResponse);

      const result = await service.delete(request);

      expect(validateOrReject).toHaveBeenCalled();
      expect(clientProxySpy).toHaveBeenCalled();
      expect(callMicroserviceHelper).toHaveBeenCalled();
      expect(result).toEqual(microserviceResponse);
    });

    it('should return status UNCHANGED when user already deleted', async () => {
      const request: SoftDeleteUserRequest = { userId: 6 };
      const unchangedResponse: BaseResponse<SoftDeleteUserResponse | null> = buildBaseResponse(
        StatusKey.UNCHANGED,
        null,
      );
      (callMicroserviceHelper as jest.Mock).mockResolvedValue(unchangedResponse);

      const result = await service.delete(request);

      expect(result.statusKey).toBe(StatusKey.UNCHANGED);
      expect(result.data).toBeNull();
    });

    it('should propagate BadRequestException when validator errors', async () => {
      const request = { userId: 'acd' } as unknown as SoftDeleteUserRequest;
      const rpcError = {
        code: HTTP_ERROR_CODE.BAD_REQUEST,
        message: 'common.errors.validationError',
      };
      (validateOrReject as jest.Mock).mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await service.delete(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.BAD_REQUEST);
      }
    });

    it('should propagate NOT_FOUND error from microservice when user not exist', async () => {
      const request: SoftDeleteUserRequest = { userId: 999 };
      const rpcError = {
        code: HTTP_ERROR_CODE.NOT_FOUND,
        message: 'common.user.notFound',
      };
      (callMicroserviceHelper as jest.Mock).mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await service.delete(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.NOT_FOUND);
      }
    });

    it('should propagate SERVICE_UNAVAILABLE error from microservice', async () => {
      const request: SoftDeleteUserRequest = { userId: 3 };
      const rpcError = {
        code: HTTP_ERROR_CODE.SERVICE_UNAVAILABLE,
        message: 'common.errors.unavailableService',
      };
      (callMicroserviceHelper as jest.Mock).mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await service.delete(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(
          HTTP_ERROR_CODE.SERVICE_UNAVAILABLE,
        );
      }
    });
    it('should propagate INTERNAL_SERVER_ERROR when service fails logic', async () => {
      const request: SoftDeleteUserRequest = { userId: 4 };
      const rpcError = {
        code: HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        message: 'common.errors.internalServerError',
      };
      (callMicroserviceHelper as jest.Mock).mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await service.delete(request);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(
          HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        );
      }
    });
  });
});
