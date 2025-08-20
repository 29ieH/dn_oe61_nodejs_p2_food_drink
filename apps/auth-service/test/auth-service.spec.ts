import { USER_SERVICE } from '@app/common/constant/service.constant';
/* eslint-disable @typescript-eslint/unbound-method */
import { LoginRequestDto } from '@app/common/dto/auth/requests/login.request';
import { UserResponse } from '@app/common/dto/user/responses/user.response';
import { HTTP_ERROR_CODE } from '@app/common/enums/errors/http-error-code';
import { TypedRpcException } from '@app/common/exceptions/rpc-exceptions';
import * as micro from '@app/common/helpers/microservices';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { JwtService, JsonWebTokenError, TokenExpiredError } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import * as classValidator from 'class-validator';
import { AuthProvider, Provider } from '../../user-service/generated/prisma';
import { AuthService } from '../src/auth-service.service';
import { PayLoadJWT } from '@app/common/dto/user/sign-token.dto';
import { UserStatus } from '@app/common/enums/user-status.enum';

describe('AuthService', () => {
  let service: AuthService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('fake-jwt-token'),
            verifyAsync: jest.fn(),
          },
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
          useValue: { get: jest.fn().mockReturnValue(3600) },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.spyOn(classValidator, 'validateOrReject').mockResolvedValue();
  });
  describe('Login', () => {
    it('should login successfully with correct credentials', async () => {
      const dto: LoginRequestDto = { email: 'test@example.com', password: '123456' };
      const userByEmail: UserResponse = {
        id: 1,
        name: 'Test User',
        userName: 'testuser',
        email: 'test@example.com',
        imageUrl: undefined,
        createdAt: new Date(),
        updatedAt: null,
        deletedAt: null,
        role: 'USER',
        status: UserStatus.ACTIVE.toString(),
        authProviders: [
          { id: 1, provider: Provider.LOCAL, password: 'hashed-password' } as AuthProvider,
        ],
      };
      jest.spyOn(micro, 'callMicroservice').mockResolvedValue(userByEmail);
      jest.spyOn(service, 'comparePassword').mockResolvedValue(true);
      const result = await service.login(dto);
      expect(result.data?.accessToken).toBe('fake-jwt-token');
      expect(result.data?.user.email).toBe('test@example.com');
    });
    it('should handle login for a user without an email', async () => {
      const userWithoutEmail: UserResponse = {
        id: 1,
        name: 'Test User',
        userName: 'testuser',
        email: null,
        imageUrl: undefined,
        createdAt: new Date(),
        updatedAt: null,
        deletedAt: null,
        role: 'USER',
        status: UserStatus.ACTIVE.toString(),
        authProviders: [
          { id: 1, provider: Provider.LOCAL, password: 'hashed-password' } as AuthProvider,
        ],
      };
      jest.spyOn(micro, 'callMicroservice').mockResolvedValue(userWithoutEmail);
      jest.spyOn(service, 'comparePassword').mockResolvedValue(true);
      const result = await service.login({ email: 'test@example.com', password: '123456' });
      expect(result.data?.accessToken).toBe('fake-jwt-token');
      expect(result.data?.user.email).toBe('');
    });
    it('should throw unauthorized if user not found', async () => {
      const dto: LoginRequestDto = { email: 'notfound@example.com', password: '123456' };
      jest.spyOn(micro, 'callMicroservice').mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow(
        new TypedRpcException({
          code: HTTP_ERROR_CODE.UNAUTHORIZED,
          message: 'common.auth.invalidCredentials',
        }),
      );
    });
    it('should throw unauthorized if passwordLocal is missing', async () => {
      const dto: LoginRequestDto = { email: 'nopass@example.com', password: '123456' };
      const user: UserResponse = {
        id: 1,
        name: 'Test User',
        userName: 'testuser',
        email: 'test@example.com',
        imageUrl: undefined,
        createdAt: new Date(),
        updatedAt: null,
        deletedAt: null,
        role: 'USER',
        status: UserStatus.ACTIVE.toString(),
        authProviders: [],
      };
      jest.spyOn(micro, 'callMicroservice').mockResolvedValue(user);
      await expect(service.login(dto)).rejects.toThrow(
        new TypedRpcException({
          code: HTTP_ERROR_CODE.UNAUTHORIZED,
          message: 'common.auth.invalidCredentials',
        }),
      );
    });
    it('should throw unauthorized if password does not match', async () => {
      const dto: LoginRequestDto = { email: 'wrongpass@example.com', password: 'wrongpass' };
      const user: UserResponse = {
        id: 1,
        name: 'Test User',
        userName: 'testuser',
        email: 'test@example.com',
        imageUrl: undefined,
        createdAt: new Date(),
        updatedAt: null,
        deletedAt: null,
        role: 'USER',
        status: UserStatus.ACTIVE.toString(),
        authProviders: [
          { id: 1, provider: Provider.LOCAL, password: 'hashed-password' } as AuthProvider,
        ],
      };
      jest.spyOn(micro, 'callMicroservice').mockResolvedValue(user);
      jest.spyOn(service, 'comparePassword').mockResolvedValue(false);
      await expect(service.login(dto)).rejects.toThrow(
        new TypedRpcException({
          code: HTTP_ERROR_CODE.UNAUTHORIZED,
          message: 'common.auth.invalidCredentials',
        }),
      );
    });
    it('should throw internal server error if jwt signing fails', async () => {
      const dto: LoginRequestDto = { email: 'test@example.com', password: '123456' };
      const user: UserResponse = {
        id: 1,
        name: 'Test User',
        userName: 'testuser',
        email: 'test@example.com',
        imageUrl: undefined,
        createdAt: new Date(),
        updatedAt: null,
        deletedAt: null,
        role: 'USER',
        status: UserStatus.ACTIVE.toString(),
        authProviders: [
          { id: 1, provider: Provider.LOCAL, password: 'hashed-password' } as AuthProvider,
        ],
      };
      const rpcError = {
        code: HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        message: 'common.errors.internalServerError',
      } as const;
      jest.spyOn(micro, 'callMicroservice').mockResolvedValue(user);
      jest.spyOn(service, 'comparePassword').mockResolvedValue(true);
      jest
        .spyOn(service['jwtService'], 'signAsync')
        .mockRejectedValue(new TypedRpcException(rpcError));
      try {
        await service.login(dto);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(
          HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        );
      }
    });
    it('should propagate unauthorized if inactive user', async () => {
      const dto: LoginRequestDto = { email: 'nopass@example.com', password: '123456' };
      const user: UserResponse = {
        id: 1,
        name: 'Test User',
        userName: 'testuser',
        email: 'test@example.com',
        imageUrl: undefined,
        createdAt: new Date(),
        updatedAt: null,
        deletedAt: null,
        role: 'USER',
        status: UserStatus.INACTIVE.toString(),
        authProviders: [],
      };
      jest.spyOn(micro, 'callMicroservice').mockResolvedValue(user);
      await expect(service.login(dto)).rejects.toThrow(
        new TypedRpcException({
          code: HTTP_ERROR_CODE.UNAUTHORIZED,
          message: 'common.auth.inactiveAccount',
        }),
      );
    });
    it('should propagate unauthorized if user deleted', async () => {
      const dto: LoginRequestDto = { email: 'nopass@example.com', password: '123456' };
      const user: UserResponse = {
        id: 1,
        name: 'Test User',
        userName: 'testuser',
        email: 'test@example.com',
        imageUrl: undefined,
        createdAt: new Date(),
        updatedAt: null,
        deletedAt: new Date(),
        role: 'USER',
        status: UserStatus.ACTIVE.toString(),
        authProviders: [],
      };
      jest.spyOn(micro, 'callMicroservice').mockResolvedValue(user);
      await expect(service.login(dto)).rejects.toThrow(
        new TypedRpcException({
          code: HTTP_ERROR_CODE.UNAUTHORIZED,
          message: 'common.auth.invalidCredentials',
        }),
      );
    });
    it('should propagate validation error coming from UserService', async () => {
      const dto: LoginRequestDto = { email: 'invalid-email.com', password: '123' };
      jest.spyOn(classValidator, 'validateOrReject').mockResolvedValue();
      const rpcError = {
        code: HTTP_ERROR_CODE.BAD_REQUEST,
        message: 'common.errors.validationError',
      } as const;
      jest.spyOn(micro, 'callMicroservice').mockRejectedValueOnce(new TypedRpcException(rpcError));
      try {
        await service.login(dto);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.BAD_REQUEST);
      }
    });
  });
  describe('comparePassword', () => {
    it('should return true when bcrypt.compare resolves true', async () => {
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true as never);
      const result = await service.comparePassword('plain', 'hashed');
      expect(result).toBe(true);
    });
    it('should return false when bcrypt.compare resolves false', async () => {
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(false as never);
      const result = await service.comparePassword('plain', 'hashed');
      expect(result).toBe(false);
    });
  });
  describe('signJwtToken', () => {
    const data: PayLoadJWT = {
      id: 1,
      name: 'John',
      role: 'USER',
      providerName: 'LOCAL',
      deletedAt: null,
      status: UserStatus.ACTIVE.toString(),
      email: 'john@example.com',
    };

    it('should throw RpcException when data is null', async () => {
      await expect(service.signJwtToken(null as unknown as PayLoadJWT)).rejects.toThrow(
        RpcException,
      );
    });

    it('should sign token successfully', async () => {
      const token = 'new-token';
      jest.spyOn(service['jwtService'], 'signAsync').mockResolvedValue(token);
      const result = await service.signJwtToken(data);
      expect(result).toEqual({
        accessToken: token,
        user: {
          id: data.id,
          email: data.email,
          name: data.name,
          role: data.role,
        },
      });
      expect(service['jwtService'].signAsync).toHaveBeenCalledWith(data, {
        secret: '3600',
      });
    });

    it('should throw RpcException when signAsync returns null', async () => {
      jest.spyOn(service['jwtService'], 'signAsync').mockResolvedValue(null as unknown as string);

      await expect(service.signJwtToken(data)).rejects.toThrow(RpcException);
    });

    it('should throw RpcException when signAsync throws error', async () => {
      jest.spyOn(service['jwtService'], 'signAsync').mockRejectedValue(new Error('jwt error'));

      await expect(service.signJwtToken(data)).rejects.toThrow(RpcException);
    });

    it('should throw RpcException when jwt.secretKey is missing', async () => {
      jest.spyOn(service['configService'], 'get').mockReturnValue(undefined);
      jest.spyOn(service['jwtService'], 'signAsync').mockResolvedValue('token-without-secret');

      await expect(service.signJwtToken(data)).rejects.toThrow(RpcException);
    });
  });

  describe('signJwtTokenUserCreate', () => {
    const data: PayLoadJWT = {
      id: 2,
      name: 'Jane',
      role: 'USER',
      providerName: 'LOCAL',
      status: UserStatus.ACTIVE.toString(),
      email: 'jane@example.com',
      deletedAt: null,
    };

    it('should throw RpcException when data is null', async () => {
      await expect(service.signJwtTokenUserCreate(null as unknown as PayLoadJWT)).rejects.toThrow(
        RpcException,
      );
    });

    it('should sign token successfully', async () => {
      const token = 'create-user-token';
      jest.spyOn(service['jwtService'], 'signAsync').mockResolvedValue(token);

      const result = await service.signJwtTokenUserCreate(data);

      expect(result).toBe(token);
      expect(service['jwtService'].signAsync).toHaveBeenCalledWith(data, { secret: '3600' });
    });

    it('should throw RpcException when signAsync returns null', async () => {
      jest.spyOn(service['jwtService'], 'signAsync').mockResolvedValue(null as unknown as string);

      await expect(service.signJwtTokenUserCreate(data)).rejects.toThrow(RpcException);
    });

    it('should throw RpcException when signAsync throws error', async () => {
      jest.spyOn(service['jwtService'], 'signAsync').mockRejectedValue(new Error('jwt error'));

      await expect(service.signJwtTokenUserCreate(data)).rejects.toThrow(RpcException);
    });

    it('should throw RpcException when jwt.secretKey is missing', async () => {
      jest.spyOn(service['configService'], 'get').mockReturnValue(undefined);
      jest.spyOn(service['jwtService'], 'signAsync').mockResolvedValue('token-without-secret');

      await expect(service.signJwtTokenUserCreate(data)).rejects.toThrow(RpcException);
    });
  });

  describe('validateToken', () => {
    let jwtService: jest.Mocked<JwtService>;

    beforeEach(() => {
      jwtService = service['jwtService'] as jest.Mocked<JwtService>;
    });

    it('should throw RpcException if token is not provided', async () => {
      await expect(service.validateToken(null as unknown as string)).rejects.toThrow(
        new RpcException('common.errors.registerUser.notToken'),
      );
    });

    it('should throw RpcException if token is expired', async () => {
      jwtService.verifyAsync.mockRejectedValue(new TokenExpiredError('expired', new Date()));
      await expect(service.validateToken('expired-token')).rejects.toThrow(
        new RpcException('common.guard.invalid_or_expired_token'),
      );
    });

    it('should throw RpcException if token is invalid', async () => {
      jwtService.verifyAsync.mockRejectedValue(new JsonWebTokenError('invalid'));
      await expect(service.validateToken('invalid-token')).rejects.toThrow(
        new RpcException('common.guard.invalid_or_expired_token'),
      );
    });

    it('should re-throw other errors', async () => {
      const error = new Error('Some other error');
      jwtService.verifyAsync.mockRejectedValue(error);
      await expect(service.validateToken('any-token')).rejects.toThrow(error);
    });

    it('should return payload if token is valid', async () => {
      const payload = { id: 1, email: 'test@example.com', role: 'USER' };
      jwtService.verifyAsync.mockResolvedValue(payload);
      const result = await service.validateToken('valid-token');
      expect(result).toEqual(payload);
    });
  });
});
