import { USER_SERVICE } from '@app/common/constant/service.constant';
import { ProfileFacebookUser } from '@app/common/dto/user/requests/facebook-user-dto.request';
import { UserResponse } from '@app/common/dto/user/responses/user.response';
import { HTTP_ERROR_CODE } from '@app/common/enums/errors/http-error-code';
import { TypedRpcException } from '@app/common/exceptions/rpc-exceptions';
import * as micro from '@app/common/helpers/microservices';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as classValidator from 'class-validator';
import { AuthService } from '../src/auth-service.service';
import { ConfigService } from '@nestjs/config';

describe('AuthService - loginFromFacebook', () => {
  let service: AuthService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('fake-jwt-token') },
        },
        {
          provide: USER_SERVICE,
          useValue: { send: jest.fn() },
        },
        {
          provide: CustomLogger,
          useValue: { error: jest.fn(), log: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('fake-jwt-token') },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.spyOn(classValidator, 'validateOrReject').mockResolvedValue();
  });

  it('should login successfully with facebook profile', async () => {
    const dto: ProfileFacebookUser = {
      providerId: '123456',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      avatarUrl: 'http://avatar.url',
    };

    const userDetail: UserResponse = {
      id: 1,
      name: 'Test User',
      userName: 'testuser',
      email: 'test@example.com',
      imageUrl: undefined,
      createdAt: new Date(),
      deletedAt: null,
      updatedAt: null,
      role: 'USER',
      status: 'ACTIVE',
      authProviders: [],
    };

    jest.spyOn(micro, 'callMicroservice').mockResolvedValue(userDetail);

    const result = await service.loginFromFacebook(dto);

    expect(result.data?.accessToken).toBe('fake-jwt-token');
    expect(result.data?.user.email).toBe('test@example.com');
  });

  it('should throw internal server error if jwt signing fails', async () => {
    const dto: ProfileFacebookUser = {
      providerId: '123456',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      avatarUrl: 'http://avatar.url',
    };

    const userDetail: UserResponse = {
      id: 1,
      name: 'Test User',
      userName: 'testuser',
      email: 'test@example.com',
      imageUrl: undefined,
      createdAt: new Date(),
      updatedAt: null,
      deletedAt: null,
      role: 'USER',
      status: 'ACTIVE',
      authProviders: [],
    };

    jest.spyOn(micro, 'callMicroservice').mockResolvedValue(userDetail);
    jest.spyOn(service['jwtService'], 'signAsync').mockRejectedValue(new Error('sign error'));

    await expect(service.loginFromFacebook(dto)).rejects.toThrow(
      new TypedRpcException({
        code: HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        message: 'common.errors.internalServerError',
      }),
    );
  });

  it('should propagate validation error coming from UserService', async () => {
    const dto: ProfileFacebookUser = {
      providerId: '123456',
      email: 'invalid-email',
      firstName: 'Test',
      lastName: 'User',
      avatarUrl: 'http://avatar.url',
    };

    jest.spyOn(micro, 'callMicroservice').mockRejectedValueOnce(
      new TypedRpcException({
        code: HTTP_ERROR_CODE.BAD_REQUEST,
        message: 'common.errors.validationError',
      }),
    );
    await expect(service.loginFromFacebook(dto)).rejects.toThrow(
      new TypedRpcException({
        code: HTTP_ERROR_CODE.BAD_REQUEST,
        message: 'common.errors.validationError',
      }),
    );
  });

  it('should propagate conflict error coming from UserService', async () => {
    const dto: ProfileFacebookUser = {
      providerId: '123456',
      email: 'conflict@example.com',
      firstName: 'Conflict',
      lastName: 'User',
      avatarUrl: 'http://avatar.conflict.url',
    };
    const rpcError = {
      code: HTTP_ERROR_CODE.CONFLICT,
      message: 'common.errors.conflictError',
    } as const;
    jest.spyOn(micro, 'callMicroservice').mockRejectedValueOnce(new TypedRpcException(rpcError));
    try {
      await service.loginFromFacebook(dto);
    } catch (error) {
      expect(error).toBeInstanceOf(TypedRpcException);
      expect((error as TypedRpcException).getError()).toEqual(rpcError);
      expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.CONFLICT);
    }
  });
});
