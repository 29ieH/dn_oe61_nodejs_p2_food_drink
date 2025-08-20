import { AUTH_SERVICE, NOTIFICATION_SERVICE } from '@app/common/constant/service.constant';
import { LoginRequestDto } from '@app/common/dto/auth/requests/login.request';
import { CreateUserDto } from '@app/common/dto/user/create-user.dto';
import { UserResponse } from '@app/common/dto/user/responses/user.response';
import { StatusKey } from '@app/common/enums/status-key.enum';
import { HTTP_ERROR_CODE } from '@app/common/enums/errors/http-error-code';
import { TypedRpcException } from '@app/common/exceptions/rpc-exceptions';
import * as micro from '@app/common/helpers/microservices';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../src/auth/auth.service';
import { of } from 'rxjs';
import { USER_SERVICE } from '@app/common/constant/service.constant';
import { I18nService } from 'nestjs-i18n';
import { ConfigService } from '@nestjs/config';
import { TwitterProfileDto } from '@app/common/dto/twitter-profile.dto';
import { GoogleProfileDto } from '@app/common/dto/google-profile.dro';
import { BadRequestException } from '@nestjs/common';
import { UserStatus } from '@app/common/enums/user-status.enum';

afterEach(() => {
  jest.clearAllMocks();
});
describe('ApiGateway AuthService', () => {
  let service: AuthService;
  const userClientMock: { send: jest.Mock } = { send: jest.fn() };
  const authClientMock: { send: jest.Mock } = { send: jest.fn() };
  const notificationClientMock: { send: jest.Mock } = { send: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: AUTH_SERVICE,
          useValue: authClientMock,
        },
        {
          provide: CustomLogger,
          useValue: { error: jest.fn(), log: jest.fn() },
        },
        {
          provide: USER_SERVICE,
          useValue: userClientMock,
        },
        {
          provide: I18nService,
          useValue: { translate: jest.fn().mockReturnValue('Translated msg') },
        },
        {
          provide: NOTIFICATION_SERVICE,
          useValue: notificationClientMock,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-value') },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should login successfully', async () => {
    const dto: LoginRequestDto = { email: 'test@example.com', password: '123456' };
    const response = {
      status: 200,
      data: {
        accessToken: 'token',
        user: { id: 1, email: 'test@example.com', name: 'Test', role: 'USER' },
      },
    };
    jest.spyOn(micro, 'callMicroservice').mockResolvedValue(response);
    const result = await service.login(dto);
    expect(result).toEqual(response);
    expect(micro.callMicroservice).toHaveBeenCalled();
  });
  it('should propagate error from AuthService microservice', async () => {
    const dto: LoginRequestDto = { email: 'test@example.com', password: '123456' };
    jest.spyOn(micro, 'callMicroservice').mockRejectedValueOnce(
      new TypedRpcException({
        code: HTTP_ERROR_CODE.UNAUTHORIZED,
        message: 'common.auth.invalidCredentials',
      }),
    );
    await expect(service.login(dto)).rejects.toThrow(TypedRpcException);
  });
  it('should propagate error from AuthService microservice down', async () => {
    const dto: LoginRequestDto = { email: 'test@example.com', password: '123456' };
    const rpcError = {
      code: HTTP_ERROR_CODE.SERVICE_UNAVAILABLE,
      message: 'common.errors.unavailableService',
    } as const;
    jest.spyOn(micro, 'callMicroservice').mockRejectedValueOnce(new TypedRpcException(rpcError));
    try {
      await service.login(dto);
    } catch (error) {
      expect(error).toBeInstanceOf(TypedRpcException);
      expect((error as TypedRpcException).getError()).toEqual(rpcError);
      expect((error as TypedRpcException).getError().code).toEqual(
        HTTP_ERROR_CODE.SERVICE_UNAVAILABLE,
      );
    }
  });

  describe('twitterCallback', () => {
    const baseProfile: TwitterProfileDto = {
      twitterId: 'tw1',
      name: 'John',
      userName: 'johnny',
    };

    it('should throw BadRequestException when user is null', async () => {
      await expect(service.twitterCallback(null as unknown as TwitterProfileDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return response when user exists', async () => {
      const existingUser = {
        id: 1,
        email: 'a@mail.com',
        name: 'John',
        role: 'USER',
        userName: 'johnny',
        providerName: 'twitter',
      };
      const token = 'token123';
      const loginResponse = {
        accessToken: token,
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role,
        },
      };

      userClientMock.send.mockReturnValueOnce(of(existingUser)); // checkUserExists
      authClientMock.send.mockReturnValueOnce(of(loginResponse)); // signJwtToken

      const result = await service.twitterCallback(baseProfile);

      expect(result).toEqual({
        statusKey: 'success',
        data: loginResponse,
      });
      expect(userClientMock.send).toHaveBeenCalledTimes(1);
      expect(authClientMock.send).toHaveBeenCalledTimes(1);
    });

    it('should create user when not exists and return token', async () => {
      const createdUser = {
        id: 2,
        email: 'b@mail.com',
        name: 'Bob',
        role: 'USER',
        userName: 'bobby',
        providerName: 'twitter',
      };
      const token = 'token456';
      const loginResponse = {
        accessToken: token,
        user: {
          id: createdUser.id,
          email: createdUser.email,
          name: createdUser.name,
          role: createdUser.role,
        },
      };

      userClientMock.send
        .mockReturnValueOnce(of(null)) // checkUserExists
        .mockReturnValueOnce(of(createdUser)); // createOauthUser
      authClientMock.send.mockReturnValueOnce(of(loginResponse)); // signJwtToken

      const profile = { ...baseProfile, twitterId: 'tw2', name: 'Bob', userName: 'bobby' };

      const result = await service.twitterCallback(profile);

      expect(result.data?.accessToken).toBe(token);
      expect(result.data?.user.id).toBe(createdUser.id);
      expect(userClientMock.send).toHaveBeenCalledTimes(2);
      expect(authClientMock.send).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when token signing fails', async () => {
      const existingUser = {
        id: 3,
        email: 'c@mail.com',
        name: 'Cat',
        role: 'USER',
        userName: 'cat',
        providerName: 'twitter',
      };

      userClientMock.send.mockReturnValueOnce(of(existingUser)); // checkUserExists
      authClientMock.send.mockReturnValueOnce(of(null)); // signJwtToken

      await expect(service.twitterCallback(baseProfile)).rejects.toThrow(BadRequestException);
    });
    it('should handle user without email', async () => {
      const existingUser = {
        id: 1,
        name: 'John',
        role: 'USER',
        userName: 'johnny',
        providerName: 'twitter',
      };
      const token = 'token123';
      const loginResponse = {
        accessToken: token,
        user: {
          id: existingUser.id,
          name: existingUser.name,
          role: existingUser.role,
        },
      };

      userClientMock.send.mockReturnValueOnce(of(existingUser)); // checkUserExists
      authClientMock.send.mockReturnValueOnce(of(loginResponse)); // signJwtToken

      await service.twitterCallback(baseProfile);

      expect(authClientMock.send).toHaveBeenCalledWith(
        { cmd: 'sign_jwt_token' },
        {
          id: existingUser.id,
          name: existingUser.name,
          role: existingUser.role,
          email: undefined,
        },
      );
    });
  });

  describe('googleCallback', () => {
    const baseProfile: GoogleProfileDto = {
      googleId: 'g1',
      email: 'g@mail.com',
      name: 'Gina',
      userName: 'gina',
    };

    it('should throw BadRequestException when user is null', async () => {
      await expect(service.googleCallback(null as unknown as GoogleProfileDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return response when user exists', async () => {
      const existingUser = {
        id: 11,
        email: 'g@mail.com',
        name: 'Gina',
        role: 'USER',
        userName: 'gina',
        providerName: 'google',
      };
      const token = 'g-token';
      const loginResponse = {
        accessToken: token,
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role,
        },
      };

      userClientMock.send.mockReturnValueOnce(of(existingUser));
      authClientMock.send.mockReturnValueOnce(of(loginResponse));

      const result = await service.googleCallback(baseProfile);

      expect(result).toEqual({
        statusKey: 'success',
        data: loginResponse,
      });
      expect(userClientMock.send).toHaveBeenCalledTimes(1);
      expect(authClientMock.send).toHaveBeenCalledTimes(1);
    });

    it('should create user when not exists and return token', async () => {
      const createdUser = {
        id: 12,
        email: 'b@mail.com',
        name: 'Bob',
        role: 'USER',
        userName: 'bob',
        providerName: 'google',
      };
      const token = 'g-token2';
      const loginResponse = {
        accessToken: token,
        user: {
          id: createdUser.id,
          email: createdUser.email,
          name: createdUser.name,
          role: createdUser.role,
        },
      };

      userClientMock.send.mockReturnValueOnce(of(null)).mockReturnValueOnce(of(createdUser));
      authClientMock.send.mockReturnValueOnce(of(loginResponse));

      const profile = {
        ...baseProfile,
        googleId: 'g2',
        email: 'b@mail.com',
        name: 'Bob',
        userName: 'bob',
      };

      const result = await service.googleCallback(profile);

      expect(result.data?.accessToken).toBe(token);
      expect(result.data?.user.id).toBe(createdUser.id);
      expect(userClientMock.send).toHaveBeenCalledTimes(2);
      expect(authClientMock.send).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when token signing fails', async () => {
      const existingUser = {
        id: 13,
        email: 'c@mail.com',
        name: 'Cat',
        role: 'USER',
        userName: 'cat',
        providerName: 'google',
      };

      userClientMock.send.mockReturnValueOnce(of(existingUser));
      authClientMock.send.mockReturnValueOnce(of(null));

      await expect(service.googleCallback(baseProfile)).rejects.toThrow(BadRequestException);
    });

    it('should handle user without email', async () => {
      const existingUser = {
        id: 11,
        name: 'Gina',
        role: 'USER',
        userName: 'gina',
        providerName: 'google',
      };
      const token = 'g-token';
      const loginResponse = {
        accessToken: token,
        user: {
          id: existingUser.id,
          name: existingUser.name,
          role: existingUser.role,
        },
      };

      userClientMock.send.mockReturnValueOnce(of(existingUser));
      authClientMock.send.mockReturnValueOnce(of(loginResponse));

      await service.googleCallback(baseProfile);

      expect(authClientMock.send).toHaveBeenCalledWith(
        { cmd: 'sign_jwt_token' },
        {
          id: existingUser.id,
          name: existingUser.name,
          role: existingUser.role,
          email: undefined,
        },
      );
    });
  });

  describe('register', () => {
    let userInput: CreateUserDto;
    let existingUser: UserResponse;

    beforeEach(() => {
      userInput = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        userName: 'testuser',
      };

      existingUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        userName: 'testuser',
        status: UserStatus.ACTIVE.toString(),
        deletedAt: null,
        role: 'user',
      };
    });

    it('should register a new user if email does not exist', async () => {
      const newUser: UserResponse = { ...existingUser, id: 2 };
      const callMicroserviceSpy = jest
        .spyOn(micro, 'callMicroservice')
        .mockResolvedValueOnce(null) // USER_GET_BY_EMAIL
        .mockResolvedValueOnce(newUser) // REGISTER_USER
        .mockResolvedValueOnce('activation-token') // SIGN_JWT_TOKEN_USER_CREATE
        .mockResolvedValueOnce(undefined); // SEND_EMAIL_COMPLETE

      const result = await service.register(userInput);

      expect(result.statusKey).toBe(StatusKey.SUCCESS);
      expect(result.data).toEqual(newUser);
      expect(callMicroserviceSpy).toHaveBeenCalledTimes(4);
    });

    it('should throw BadRequestException if user already exists', async () => {
      const callMicroserviceSpy = jest
        .spyOn(micro, 'callMicroservice')
        .mockResolvedValueOnce(existingUser); // USER_GET_BY_EMAIL returns user

      await expect(service.register(userInput)).rejects.toThrow(BadRequestException);
      expect(callMicroserviceSpy).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException if register returns null', async () => {
      const callMicroserviceSpy = jest
        .spyOn(micro, 'callMicroservice')
        .mockResolvedValueOnce(null) // USER_GET_BY_EMAIL
        .mockResolvedValueOnce(null); // REGISTER_USER returns null

      await expect(service.register(userInput)).rejects.toThrow(BadRequestException);
      expect(callMicroserviceSpy).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException if token generation returns null', async () => {
      const newUser: UserResponse = { ...existingUser, id: 2 };
      const callMicroserviceSpy = jest
        .spyOn(micro, 'callMicroservice')
        .mockResolvedValueOnce(null) // USER_GET_BY_EMAIL
        .mockResolvedValueOnce(newUser) // REGISTER_USER
        .mockResolvedValueOnce(null); // SIGN_JWT_TOKEN_USER_CREATE returns null

      await expect(service.register(userInput)).rejects.toThrow(BadRequestException);
      expect(callMicroserviceSpy).toHaveBeenCalledTimes(3);
    });

    it('should throw BadRequestException if userInput is null or empty', async () => {
      await expect(service.register(null as unknown as CreateUserDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.register({} as CreateUserDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeRegister', () => {
    it('should complete registration successfully', async () => {
      const token = 'valid-token';
      const userPayload = { id: 1, email: 'test@example.com' };
      const activatedUser: UserResponse = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        userName: 'testuser',
        status: UserStatus.ACTIVE.toString(),
        deletedAt: null,
        role: 'user',
      };

      const callMicroserviceSpy = jest
        .spyOn(micro, 'callMicroservice')
        .mockResolvedValueOnce(userPayload) // VALIDATE_USER
        .mockResolvedValueOnce(activatedUser); // CHANGE_IS_ACTIVE

      const result = await service.completeRegister(token);

      expect(result.statusKey).toBe(StatusKey.SUCCESS);
      expect(result.data).toEqual(activatedUser);
      expect(callMicroserviceSpy).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException if token is null or empty', async () => {
      await expect(service.completeRegister(null as unknown as string)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.completeRegister('')).rejects.toThrow(BadRequestException);
      await expect(service.completeRegister(123 as unknown as string)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if token validation fails', async () => {
      const token = 'invalid-token';
      const callMicroserviceSpy = jest.spyOn(micro, 'callMicroservice').mockResolvedValueOnce(null);

      await expect(service.completeRegister(token)).rejects.toThrow(BadRequestException);
      expect(callMicroserviceSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('logout', () => {
    it('should clear cookie and return success', () => {
      const mockRes = {
        clearCookie: jest.fn(),
        cookie: jest.fn(),
      };

      const result = service.logout(mockRes);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('token');
      expect(result.statusKey).toBe(StatusKey.SUCCESS);
      expect(result.data).toBe('');
    });
  });
});
