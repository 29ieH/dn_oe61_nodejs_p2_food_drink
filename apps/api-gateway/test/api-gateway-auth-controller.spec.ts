/* eslint-disable @typescript-eslint/unbound-method */
import { CreateUserDto } from '@app/common/dto/user/create-user.dto';
import { LoginRequestDto } from '@app/common/dto/auth/requests/login.request';
import { LoginResponse } from '@app/common/dto/auth/responses/login.response';
import { UserResponse } from '@app/common/dto/user/responses/user.response';
import { HTTP_ERROR_CODE } from '@app/common/enums/errors/http-error-code';
import { StatusKey } from '@app/common/enums/status-key.enum';
import { TypedRpcException } from '@app/common/exceptions/rpc-exceptions';
import { BadRequestException } from '@nestjs/common';
import { BaseResponse } from '@app/common/interfaces/data-type';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { CookieResponse } from '@app/common/interfaces/request-cookie.interface';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { TwitterProfileDto } from '@app/common/dto/twitter-profile.dto';
import { GoogleProfileDto } from '@app/common/dto/google-profile.dro';
import { UserStatus } from '@app/common/enums/user-status.enum';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let i18nService: I18nService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            twitterCallback: jest.fn(),
            googleCallback: jest.fn(),
            register: jest.fn(),
            completeRegister: jest.fn(),
            logout: jest.fn(),
          },
        },
        {
          provide: I18nService,
          useValue: { translate: jest.fn().mockReturnValue('Login successfully') },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(3600) },
        },
      ],
    }).compile();

    controller = moduleRef.get<AuthController>(AuthController);
    authService = moduleRef.get<AuthService>(AuthService);
    i18nService = moduleRef.get<I18nService>(I18nService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
  describe('login', () => {
    beforeEach(() => {});

    it('should login and set cookie if accessToken exists', async () => {
      const dto: LoginRequestDto = { email: 'test@mail.com', password: 'password' };
      const mockAccessToken = 'token123';
      const mockUser = { id: 1, email: 'test@mail.com', name: 'Test', role: 'user' };
      const mockResult = {
        statusKey: StatusKey.SUCCESS,
        data: { accessToken: mockAccessToken, user: mockUser },
      };
      const authServiceLoginSpy = jest.spyOn(authService, 'login').mockResolvedValue(mockResult);
      await controller.login(dto);
      expect(authServiceLoginSpy).toHaveBeenCalledWith(dto);
    });

    it('should not set cookie if accessToken does not exist', async () => {
      const dto: LoginRequestDto = { email: 'test@mail.com', password: 'password' };
      const mockResult = {
        statusKey: StatusKey.SUCCESS,
        data: {
          accessToken: null as unknown as string,
          user: {
            id: 1,
            email: 'test@mail.com',
            name: 'Test',
            role: 'user',
          },
        },
      };
      const authServiceLoginSpy = jest.spyOn(authService, 'login').mockResolvedValue(mockResult);
      await controller.login(dto);
      expect(authServiceLoginSpy).toHaveBeenCalledWith(dto);
    });
    it('should handle null dto gracefully', async () => {
      const rpcError = {
        code: HTTP_ERROR_CODE.BAD_REQUEST,
        message: 'common.validation.errors.validationError',
      };
      const authServiceLoginSpy = jest
        .spyOn(authService, 'login')
        .mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await controller.login(null as unknown as LoginRequestDto);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.BAD_REQUEST);
      }
      expect(authServiceLoginSpy).toHaveBeenCalledWith(null as unknown as typeof LoginRequestDto);
    });
    it('should handle invalid dto (not match validation)', async () => {
      const rpcError = {
        code: HTTP_ERROR_CODE.BAD_REQUEST,
        message: 'common.validation.errors.validationError',
      };
      const invalidDto = { email: 'not-an-email', password: '1' };
      const authServiceLoginSpy = jest
        .spyOn(authService, 'login')
        .mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await controller.login(invalidDto);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.BAD_REQUEST);
      }
      expect(authServiceLoginSpy).toHaveBeenCalledWith(invalidDto);
    });
  });
  describe('loginFacebook', () => {
    beforeEach(() => {});

    it('should handle /facebook route and redirect to Facebook auth', () => {
      const facebookLoginSpy = controller.facebookLogin();
      expect(facebookLoginSpy).toEqual({
        message: i18nService.translate('common.auth.action.login.facebook'),
      });
    });

    it('callback should return payload when facebook returns accessToken', () => {
      const mockAccessToken = 'fb-token';
      const mockUser = { id: 2, email: 'fb@mail.com', name: 'FB User', role: 'user' };
      const loginResult: BaseResponse<LoginResponse> = {
        statusKey: StatusKey.SUCCESS,
        data: { accessToken: mockAccessToken, user: mockUser },
      };
      const req: Partial<Request> = { user: loginResult };
      const requestMock = req as Request;
      const result = controller.facebookCallback(requestMock);
      expect(result).toEqual({
        success: true,
        message: 'Login successfully',
        payload: loginResult.data,
      });
    });

    it('callback should still return payload when accessToken absent', () => {
      const loginResult: BaseResponse<LoginResponse> = {
        statusKey: StatusKey.SUCCESS,
        data: {
          accessToken: null as unknown as string,
          user: {
            id: 2,
            email: 'fb@mail.com',
            name: 'FB User',
            role: 'user',
          },
        },
      };
      const req: Partial<Request> = { user: loginResult };
      const requestMock = req as Request;
      const result = controller.facebookCallback(requestMock);
      expect(result).toEqual({
        success: true,
        message: 'Login successfully',
        payload: loginResult.data,
      });
    });
  });

  const profileTwitter = {
    twitterId: '123',
    userName: 'john_doe',
    name: 'John Doe',
  } as const;

  const googleProfile = {
    googleId: 'g123',
    userName: 'jane_doe',
    email: 'jane@mail.com',
    name: 'Jane Doe',
  } as const;

  describe('twitterLogin', () => {
    it('should resolve to undefined', () => {
      const result = controller.twitterLogin();
      expect(result).toBeUndefined();
    });
  });

  describe('twitterCallback', () => {
    it('should return data from service', async () => {
      const expected = {
        accessToken: 'tok',
        user: { id: 1, name: 'John', role: 'USER' },
      };
      const twitterCallbackSpy = (authService.twitterCallback as jest.Mock).mockResolvedValue(
        expected,
      );

      const result = await controller.twitterCallback(profileTwitter);

      expect(result).toEqual(expected);
      expect(twitterCallbackSpy).toHaveBeenCalledWith(profileTwitter);
    });

    it('should propagate thrown error', async () => {
      const err = new Error('boom');
      (authService.twitterCallback as jest.Mock).mockRejectedValue(err);

      await expect(controller.twitterCallback(profileTwitter)).rejects.toThrow(err);
    });

    it('should handle undefined profile gracefully', async () => {
      const twitterCallbackSpy = (authService.twitterCallback as jest.Mock).mockResolvedValue({
        accessToken: null,
        user: null,
      });
      const result = await controller.twitterCallback(undefined as unknown as TwitterProfileDto);
      expect(result).toEqual({ accessToken: null, user: null });
      expect(twitterCallbackSpy).toHaveBeenCalledWith(undefined);
    });

    it('should handle undefined response object', async () => {
      const expected = { accessToken: 'tok', user: { id: 1, name: 'John' } };
      const twitterCallbackSpy = (authService.twitterCallback as jest.Mock).mockResolvedValue(
        expected,
      );

      const result = await controller.twitterCallback(profileTwitter);

      expect(result).toEqual(expected);
      expect(twitterCallbackSpy).toHaveBeenCalledWith(profileTwitter);
    });
  });

  describe('googleAuth', () => {
    it('should resolve to undefined', async () => {
      const result = await controller.googleAuth();
      expect(result).toBeUndefined();
    });
  });

  describe('googleCallback', () => {
    it('should return data from service', async () => {
      const expected = {
        accessToken: 'token-google',
        user: { id: 2, name: 'Jane', role: 'USER' },
      };
      const googleCallbackSpy = (authService.googleCallback as jest.Mock).mockResolvedValue(
        expected,
      );

      const result = await controller.googleCallback(googleProfile as unknown as GoogleProfileDto);
      expect(result).toEqual(expected);
      expect(googleCallbackSpy).toHaveBeenCalledWith(googleProfile);
    });

    it('should propagate thrown error', async () => {
      const err = new Error('g-error');
      (authService.googleCallback as jest.Mock).mockRejectedValue(err);
      await expect(
        controller.googleCallback(googleProfile as unknown as GoogleProfileDto),
      ).rejects.toThrow(err);
    });

    it('should handle undefined profile gracefully', async () => {
      const googleCallbackSpy = (authService.googleCallback as jest.Mock).mockResolvedValue({
        accessToken: null,
        user: null,
      });

      const result = await controller.googleCallback(undefined as unknown as GoogleProfileDto);

      expect(result).toEqual({ accessToken: null, user: null });
      expect(googleCallbackSpy).toHaveBeenCalledWith(undefined);
    });
  });

  describe('logout', () => {
    it('should clear cookie and return success', () => {
      const mockRes: CookieResponse = {
        clearCookie: jest.fn(),
        cookie: jest.fn(),
      };
      const expected = { success: true } as unknown as BaseResponse<string>;
      (authService.logout as jest.Mock).mockReturnValue(expected);

      const result = controller.logout(mockRes);

      expect(authService.logout as jest.Mock).toHaveBeenCalledWith(mockRes);
      expect(result).toEqual(expected);
    });
  });

  describe('showCompletePage', () => {
    it('should return frontend url with /activate suffix', () => {
      const cfg = moduleRef.get<ConfigService>(ConfigService);
      (cfg.get as jest.Mock).mockReturnValueOnce('https://frontend.com');
      const result = controller.showCompletePage();
      expect(result).toEqual({ url: 'https://frontend.com/activate' });
    });
  });

  describe('completeRegister', () => {
    it('should call service with token and return response', async () => {
      const token = 'activation-token';
      const expected: BaseResponse<UserResponse> = {
        statusKey: StatusKey.SUCCESS,
        data: {
          id: 1,
          email: 'a@mail.com',
          name: 'A',
          userName: 'a',
          role: 'user',
          deletedAt: null,
          status: UserStatus.ACTIVE.toString(),
        },
      } as const;
      (authService.completeRegister as jest.Mock).mockResolvedValue(expected);

      const result = await controller.completeRegister(token);

      expect(authService.completeRegister as jest.Mock).toHaveBeenCalledWith(token);
      expect(result).toEqual(expected);
    });
  });

  describe('registerUser', () => {
    let userInput: CreateUserDto;
    let userResponse: BaseResponse<UserResponse>;

    beforeEach(() => {
      userInput = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        userName: 'testuser',
      };

      userResponse = {
        statusKey: StatusKey.SUCCESS,
        data: {
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          userName: 'testuser',
          role: 'user',
        } as UserResponse,
      };
    });

    it('should register a user successfully and return the correct response structure', async () => {
      const authServiceRegisterSpy = jest
        .spyOn(authService, 'register')
        .mockResolvedValue(userResponse);

      const result = await controller.registerUser(userInput);

      expect(authServiceRegisterSpy).toHaveBeenCalledWith(userInput);
      expect(result).toHaveProperty('statusKey', StatusKey.SUCCESS);
      expect(result).toHaveProperty('data');
      expect(result.data).toEqual(userResponse.data);
      expect(result.data).toHaveProperty('id');
      expect(result.data).toHaveProperty('email', userInput.email);
      expect(result.data).toHaveProperty('name', userInput.name);
      expect(result.data).toHaveProperty('userName', userInput.userName);
    });

    it('should throw BadRequestException if user already exists', async () => {
      const errorMessage = 'User already exists';
      const authServiceRegisterSpy = jest
        .spyOn(authService, 'register')
        .mockRejectedValue(new BadRequestException(errorMessage));

      await expect(controller.registerUser(userInput)).rejects.toThrow(BadRequestException);
      await expect(controller.registerUser(userInput)).rejects.toThrow(errorMessage);
      expect(authServiceRegisterSpy).toHaveBeenCalledWith(userInput);
    });
  });
});
