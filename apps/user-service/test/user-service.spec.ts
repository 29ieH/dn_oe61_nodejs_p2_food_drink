/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { ProfileFacebookUser } from '@app/common/dto/user/requests/facebook-user-dto.request';
import { SoftDeleteUserRequest } from '@app/common/dto/user/requests/soft-delete-user.request';
import { UserByEmailRequest } from '@app/common/dto/user/requests/user-by-email.request';
import { UserCreationRequest } from '@app/common/dto/user/requests/user-creation.request';
import { UserUpdateRoleRequest } from '@app/common/dto/user/requests/user-update-role.request';
import { UserUpdateStatusRequest } from '@app/common/dto/user/requests/user-update-status.request';
import { SoftDeleteUserResponse } from '@app/common/dto/user/responses/soft-delete-user.response';
import { UserResponse } from '@app/common/dto/user/responses/user.response';
import { HTTP_ERROR_CODE } from '@app/common/enums/errors/http-error-code';
import { RoleEnum } from '@app/common/enums/role.enum';
import { Role as RoleUpdate } from '@app/common/enums/roles/users.enum';
import { StatusKey } from '@app/common/enums/status-key.enum';
import { UserStatus } from '@app/common/enums/user-status.enum';
import { TypedRpcException } from '@app/common/exceptions/rpc-exceptions';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import * as prismaClientError from '@app/common/utils/prisma-client-error';
import { handlePrismaError } from '@app/common/utils/prisma-client-error';
import { PrismaService } from '@app/prisma';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import * as classValidator from 'class-validator';
import { PrismaClient, Provider, Role } from '../generated/prisma';
import { ProductProducer } from '../src/producer/product.producer';
import { UserService } from '../src/user-service.service';

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));

describe('UserService', () => {
  let service: UserService;
  let moduleRef: TestingModule;
  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: {
            client: {
              user: {
                findUnique: jest.fn(),
                create: jest.fn(),
                findFirst: jest.fn(),
                update: jest.fn(),
                findMany: jest.fn(),
              },
              role: { findUnique: jest.fn() },
              userProfile: { findUnique: jest.fn() },
              authProvider: {
                findFirst: jest.fn(),
                findUnique: jest.fn(),
              },
              $transaction: jest.fn(),
            },
          },
        },
        {
          provide: CustomLogger,
          useValue: { error: jest.fn(), log: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('default-avatar.png') },
        },
        {
          provide: ProductProducer,
          useValue: { addJobSoftDeleteCart: jest.fn() },
        },
      ],
    }).compile();
    service = moduleRef.get<UserService>(UserService);
    jest.spyOn(classValidator, 'validateOrReject').mockResolvedValue();
  });
  it('should throw validation error if dto is invalid', async () => {
    const invalidDto: UserByEmailRequest = { email: 'invalid-email' } as UserByEmailRequest;
    const rpcError = {
      code: HTTP_ERROR_CODE.BAD_REQUEST,
      message: 'common.errors.validationError',
    } as const;
    jest
      .spyOn(classValidator, 'validateOrReject')
      .mockRejectedValueOnce(new TypedRpcException(rpcError));
    try {
      await service.getUserByEmail(invalidDto);
    } catch (error) {
      expect(error).toBeInstanceOf(TypedRpcException);
      expect((error as TypedRpcException).getError()).toEqual(rpcError);
    }
  });

  it('should return null if user not found', async () => {
    const dto: UserByEmailRequest = { email: 'notfound@example.com' } as UserByEmailRequest;
    const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
    (_prismaMock.client.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
    const result = await service.getUserByEmail(dto);
    expect(result).toBeNull();
  });

  it('should return user when found', async () => {
    const dto: UserByEmailRequest = { email: 'test@example.com' } as UserByEmailRequest;
    const userRecord = {
      id: 1,
      name: 'Test User',
      userName: 'testuser',
      email: 'test@example.com',
      imageUrl: null,
      createdAt: new Date(),
      updatedAt: null,
      role: { name: 'USER' },
      authProviders: [{ id: 1, provider: Provider.LOCAL, password: 'hashed-pass' }],
    };
    const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
    (_prismaMock.client.user.findUnique as jest.Mock).mockResolvedValueOnce(userRecord);
    const result = (await service.getUserByEmail(dto)) as UserResponse;
    expect(result.email).toBe('test@example.com');
    expect(result.role).toBe('USER');
  });

  it('should handle user with no auth providers', async () => {
    const dto: UserByEmailRequest = { email: 'test@example.com' };
    const userRecord = {
      id: 1,
      name: 'Test User',
      userName: 'testuser',
      email: 'test@example.com',
      imageUrl: null,
      createdAt: new Date(),
      updatedAt: null,
      role: { name: 'USER' },
      authProviders: [],
    };
    const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
    (_prismaMock.client.user.findUnique as jest.Mock).mockResolvedValueOnce(userRecord);
    const result = await service.getUserByEmail(dto);
    expect(result?.providerName).toBeUndefined();
  });

  it('should handle null imageUrl correctly', async () => {
    const dto: UserByEmailRequest = { email: 'test@example.com' };
    const userRecord = {
      id: 1,
      name: 'Test User',
      userName: 'testuser',
      email: 'test@example.com',
      imageUrl: null,
      createdAt: new Date(),
      updatedAt: null,
      role: { name: 'USER' },
      authProviders: [],
    };
    const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
    (_prismaMock.client.user.findUnique as jest.Mock).mockResolvedValueOnce(userRecord);
    const result = await service.getUserByEmail(dto);
    expect(result?.imageUrl).toBe('');
  });
  it('should return empty string if email is null', async () => {
    const dto: UserByEmailRequest = { email: 'abc@gmail.com' };
    const userRecord = {
      id: 2,
      name: 'No Email User',
      userName: 'nouser',
      email: null,
      imageUrl: null,
      createdAt: new Date(),
      updatedAt: null,
      role: { name: 'USER' },
      authProviders: [],
    };
    const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
    (_prismaMock.client.user.findUnique as jest.Mock).mockResolvedValue(userRecord);
    const result = (await service.getUserByEmail(dto)) as UserResponse;
    expect(result.email).toBe(null);
    (_prismaMock.client.user.findUnique as jest.Mock).mockResolvedValueOnce({
      ...userRecord,
      email: undefined,
    });
  });
  describe('checkUserExists', () => {
    const providerId = '123';

    it('should throw RpcException if providerId is empty', async () => {
      await expect(service.checkUserExists('')).rejects.toThrow(RpcException);
    });

    it('should return formatted data when user exists', async () => {
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (_prismaMock.client.authProvider.findFirst as jest.Mock).mockResolvedValue({
        provider: 'TWITTER',
        user: {
          id: 5,
          name: 'John',
          userName: 'johnny',
          role: { name: 'USER' },
        },
      });
      const result = await service.checkUserExists(providerId);
      expect(result).toEqual(
        expect.objectContaining({
          id: 5,
          name: 'John',
          userName: 'johnny',
          role: 'USER',
          providerName: 'TWITTER',
        }),
      );
    });

    it('should handle user with no role gracefully', async () => {
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (_prismaMock.client.authProvider.findFirst as jest.Mock).mockResolvedValue({
        provider: 'GOOGLE',
        user: {
          id: 10,
          name: 'Alice',
          userName: 'alice01',
          role: null,
          authProviders: [],
        },
      });

      const result = await service.checkUserExists(providerId);
      expect(result).toEqual(
        expect.objectContaining({
          id: 10,
          role: undefined,
          providerName: 'GOOGLE',
        }),
      );
    });

    it('should return undefined fields when user not found', async () => {
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (_prismaMock.client.authProvider.findFirst as jest.Mock).mockResolvedValue(null);
      const result = await service.checkUserExists(providerId);
      expect(result).toBeNull();
    });
  });
  describe('getRole', () => {
    it('should return role when found', async () => {
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (_prismaMock.client.role.findUnique as jest.Mock).mockResolvedValue({ id: 1, name: 'USER' });
      const role = await service.getRole();
      expect(role?.name).toBe('USER');
    });

    it('should throw TypedRpcException when prisma fails', async () => {
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (_prismaMock.client.role.findUnique as jest.Mock).mockRejectedValue(new Error('DB Error'));
      await expect(service.getRole()).rejects.toThrow(TypedRpcException);
    });
  });

  describe('validateOAuthUserCreation', () => {
    const createDto = {
      name: 'Jane',
      userName: 'jane',
      providerId: '321',
      provider: Provider.GOOGLE,
    } as const;

    beforeEach(() => {
      jest.spyOn(service, 'checkUserExists').mockResolvedValue(null);
    });

    it('should throw ConflictException if user already exists', async () => {
      const existingUser = { id: 1, email: 'test@example.com' } as UserResponse;
      jest.spyOn(service, 'checkUserExists').mockResolvedValue(existingUser);

      await expect(service.validateOAuthUserCreation(createDto)).rejects.toThrow(
        'common.errors.createUser.exists',
      );
    });

    it('should throw RpcException when role not found', async () => {
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (_prismaMock.client.role.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.validateOAuthUserCreation(createDto)).rejects.toThrow(
        new RpcException('common.errors.createUser.roleNotFound'),
      );
    });

    it('should call createUser and return its result on successful validation', async () => {
      const role: Role = { id: 1, name: 'USER', createdAt: new Date(), updatedAt: null };
      const createdUser: UserResponse = {
        id: 1,
        name: 'Jane',
        userName: 'jane',
        role: 'USER',
        status: 'ACTIVE',
        deletedAt: null,
        email: undefined,
      };
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (_prismaMock.client.role.findUnique as jest.Mock).mockResolvedValue(role);

      const createUserSpy = jest.spyOn(service, 'createUser').mockResolvedValue(createdUser);

      const result = await service.validateOAuthUserCreation(
        createDto as unknown as Parameters<UserService['validateOAuthUserCreation']>[0],
      );

      expect(createUserSpy).toHaveBeenCalledWith(createDto, role.id);
      expect(result).toEqual(createdUser);
    });
  });

  describe('createUserWithPassword', () => {
    const dto = {
      name: 'John',
      userName: 'johnny',
      email: 'john@mail.com',
      password: 'plain-pass',
      provider: Provider.LOCAL,
      providerId: 'local-id',
    } as const;

    it('should throw validation error', async () => {
      jest.spyOn(classValidator, 'validateOrReject').mockRejectedValueOnce(new Error('validation'));
      await expect(
        service.createUserWithPassword(
          dto as unknown as Parameters<UserService['createUserWithPassword']>[0],
        ),
      ).rejects.toThrow('validation');
    });

    it('should throw RpcException when role not found', async () => {
      jest.spyOn(classValidator, 'validateOrReject').mockResolvedValue();
      jest.spyOn(service, 'getRole').mockResolvedValueOnce(null);
      await expect(
        service.createUserWithPassword(
          dto as unknown as Parameters<UserService['createUserWithPassword']>[0],
        ),
      ).rejects.toThrow(new RpcException('common.errors.createUser.roleNotFound'));
    });

    it('should throw RpcException when createUser returns null', async () => {
      jest.spyOn(service, 'getRole').mockResolvedValue({
        id: 1,
        name: 'USER',
        createdAt: new Date(),
        updatedAt: null,
      } as unknown as Role);
      jest.spyOn(service, 'createUser').mockResolvedValue(null);
      await expect(
        service.createUserWithPassword(
          dto as unknown as Parameters<UserService['createUserWithPassword']>[0],
        ),
      ).rejects.toThrow(new RpcException('common.errors.createUser.error'));
    });

    it('should hash password, call createUser and return formatted user', async () => {
      jest.spyOn(service, 'getRole').mockResolvedValue({
        id: 1,
        name: 'USER',
        createdAt: new Date(),
        updatedAt: null,
      } as unknown as Role);
      const createdUser: UserResponse = {
        id: 1,
        name: dto.name,
        userName: dto.userName,
        role: 'USER',
        status: 'ACTIVE',
        deletedAt: null,
        email: dto.email,
      };
      const createUserSpy = jest.spyOn(service, 'createUser').mockResolvedValue(createdUser);

      const result = await service.createUserWithPassword(
        dto as unknown as Parameters<UserService['createUserWithPassword']>[0],
      );

      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      expect(createUserSpy).toHaveBeenCalled();
      expect(result).toEqual(createdUser);
    });

    it('should handle undefined email correctly', async () => {
      jest.spyOn(service, 'getRole').mockResolvedValue({
        id: 1,
        name: 'USER',
        createdAt: new Date(),
        updatedAt: null,
      } as unknown as Role);
      const createdUser: UserResponse = {
        id: 1,
        name: dto.name,
        userName: dto.userName,
        role: 'USER',
        status: 'ACTIVE',
        deletedAt: null,

        email: undefined,
      };
      jest.spyOn(service, 'createUser').mockResolvedValue(createdUser);

      const result = await service.createUserWithPassword(
        dto as unknown as Parameters<UserService['createUserWithPassword']>[0],
      );

      expect(result?.email).toBeUndefined();
    });
  });

  describe('createUser', () => {
    const createDto = {
      name: 'Jane',
      userName: 'jane',
      providerId: '321',
      provider: Provider.LOCAL,
      email: 'jane@test.com',
      password: 'password',
    } as const;
    const roleId = 1;

    it('should create and return a new user successfully', async () => {
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      const dbUser = {
        ...createDto,
        id: 10,
        role: { name: 'USER' },
        authProviders: [{ provider: 'LOCAL' }],
      };
      (_prismaMock.client.user.create as jest.Mock).mockResolvedValue(dbUser);

      const result = await service.createUser(createDto, roleId);

      expect(_prismaMock.client.user.create).toHaveBeenCalledWith({
        data: {
          name: createDto.name,
          userName: createDto.userName,
          email: createDto.email,
          isActive: false,
          role: {
            connect: { id: roleId },
          },
          authProviders: {
            create: [
              {
                provider: createDto.provider,
                providerId: createDto.providerId,
                password: createDto.password,
              },
            ],
          },
          profile: {
            create: {},
          },
        },
        include: {
          authProviders: true,
          role: true,
          profile: true,
        },
      });

      expect(result).toEqual({
        id: dbUser.id,
        name: dbUser.name,
        userName: dbUser.userName,
        role: 'USER',
        email: dbUser.email,
        providerName: createDto.provider,
      });
    });

    it('should throw RpcException if prisma user.create throws an error', async () => {
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (_prismaMock.client.user.create as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await expect(service.createUser(createDto, roleId)).rejects.toThrow(
        new RpcException('common.errors.internalServerError'),
      );
    });

    it('should handle non-Error exception during user creation', async () => {
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (_prismaMock.client.user.create as jest.Mock).mockRejectedValue('DB Error String');
      await expect(service.createUser(createDto, roleId)).rejects.toThrow(RpcException);
    });

    it('should handle null email when creating user', async () => {
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      const dbUser = {
        ...createDto,
        id: 11,
        email: null,
        role: { name: 'USER' },
        authProviders: [{ provider: 'LOCAL' }],
      };
      (_prismaMock.client.user.create as jest.Mock).mockResolvedValue(dbUser);
      const result = await service.createUser(createDto, roleId);
      expect(result?.email).toBe(undefined);
    });
  });

  describe('checkUserIsActive (private)', () => {
    const targetEmail = 'inactive@mail.com';
    const userDto: UserResponse = {
      id: 1,
      name: 'abc',
      userName: 'abc',
      email: targetEmail,
      role: 'USER',
    } as unknown as UserResponse;

    it('should call prisma findFirst with correct args and return user', async () => {
      const prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      const dbUser = { id: 1 };
      (prismaMock.client.user.findFirst as jest.Mock).mockResolvedValueOnce(dbUser);

      const checkFn = (
        service as unknown as {
          checkUserIsActive: (u: UserResponse) => Promise<unknown>;
        }
      ).checkUserIsActive.bind(service);
      const result = await checkFn(userDto);

      expect(prismaMock.client.user.findFirst).toHaveBeenCalledWith({
        where: { email: targetEmail, isActive: false },
        include: { role: true, authProviders: true },
      });
      expect(result).toBe(dbUser);
    });

    it('should return null when no matching user', async () => {
      const prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (prismaMock.client.user.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const checkFn = (
        service as unknown as {
          checkUserIsActive: (u: UserResponse) => Promise<unknown>;
        }
      ).checkUserIsActive.bind(service);
      const result = await checkFn(userDto);
      expect(result).toBeNull();
    });
  });

  describe('changeIsActive', () => {
    const inactiveUser: UserResponse = {
      id: 99,
      name: 'Inactive',
      userName: 'inactive',
      email: 'inactive@mail.com',
      role: 'USER',
    } as unknown as UserResponse;

    it('should throw BAD_REQUEST when payload invalid', async () => {
      await expect(service.changeIsActive(null as unknown as UserResponse)).rejects.toThrow(
        TypedRpcException,
      );
      await expect(
        service.changeIsActive({ id: 1, name: 'A', userName: 'a' } as unknown as UserResponse),
      ).rejects.toThrow(TypedRpcException);
    });

    it('should throw alreadyActive when user already active', async () => {
      const prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (prismaMock.client.user.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(service.changeIsActive(inactiveUser)).rejects.toThrow(
        new TypedRpcException({
          code: HTTP_ERROR_CODE.BAD_REQUEST,
          message: 'common.errors.changeIsActive.alreadyActive',
        }),
      );
    });

    it('should update user and return formatted data', async () => {
      const prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      const dbUser = {
        id: inactiveUser.id,
        name: inactiveUser.name,
        userName: inactiveUser.userName,
        email: inactiveUser.email,
        role: { name: 'USER' },
        authProviders: [],
      };
      (prismaMock.client.user.findFirst as jest.Mock).mockResolvedValueOnce({ ...dbUser });
      (prismaMock.client.user.update as jest.Mock).mockResolvedValueOnce({
        ...dbUser,
        isActive: true,
      });

      const result = await service.changeIsActive(inactiveUser);

      expect(result).toEqual({
        id: dbUser.id,
        name: dbUser.name,
        userName: dbUser.userName,
        email: dbUser.email,
        role: 'USER',
        authProviders: [],
      });
      expect(prismaMock.client.user.update).toHaveBeenCalledWith({
        where: { id: dbUser.id },
        data: { isActive: true },
        include: { role: true, authProviders: true },
      });
    });

    it('should throw internalServerError when prisma update fails', async () => {
      const prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (prismaMock.client.user.findFirst as jest.Mock).mockResolvedValueOnce({ id: 1 });
      (prismaMock.client.user.update as jest.Mock).mockRejectedValueOnce(new Error('fail'));

      await expect(service.changeIsActive(inactiveUser)).rejects.toThrow(TypedRpcException);
    });

    it('should handle non-Error exception during user update', async () => {
      const prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (prismaMock.client.user.findFirst as jest.Mock).mockResolvedValueOnce({ id: 1 });
      (prismaMock.client.user.update as jest.Mock).mockRejectedValueOnce('Update failed');
      await expect(service.changeIsActive(inactiveUser)).rejects.toThrow(TypedRpcException);
    });

    it('should handle null email when updating user', async () => {
      const prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      const dbUser = {
        id: inactiveUser.id,
        name: inactiveUser.name,
        userName: inactiveUser.userName,
        email: null,
        role: { name: 'USER' },
        authProviders: [],
      };
      (prismaMock.client.user.findFirst as jest.Mock).mockResolvedValueOnce({ ...dbUser });
      (prismaMock.client.user.update as jest.Mock).mockResolvedValueOnce({
        ...dbUser,
        isActive: true,
      });

      const result = await service.changeIsActive(inactiveUser);

      expect(result?.email).toBe(undefined);
    });
  });

  describe('findOrCreateUserFromFacebook', () => {
    const profile: ProfileFacebookUser = {
      providerId: 'fb-123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@facebook.com',
    };
    it('should return a mapped user with empty imageUrl if it is null', async () => {
      const authProviderRecord = {
        providerId: 'fb-123',
        provider: Provider.FACEBOOK,
        user: {
          id: 1,
          name: 'John Doe',
          userName: 'johndoe',
          email: 'john.doe@facebook.com',
          imageUrl: null,
          createdAt: new Date(),
          updatedAt: null,
          role: { name: 'USER' },
          authProviders: [],
        },
      };

      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (_prismaMock.client.authProvider.findUnique as jest.Mock).mockResolvedValue(
        authProviderRecord,
      );
      const result = await service.findOrCreateUserFromFacebook(profile);

      expect(result.imageUrl).toBe('');
      expect(result.email).toBe(profile.email);
    });
  });
  describe('adminCreateUser', () => {
    const baseDto: UserCreationRequest = {
      name: 'John',
      password: 'password123',
      role: RoleEnum.USER,
    } as UserCreationRequest;
    it('should create user successfully', async () => {
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (_prismaMock.client.userProfile.findUnique as jest.Mock).mockResolvedValue(null);
      (_prismaMock.client.user.findUnique as jest.Mock).mockResolvedValue(null);
      const fakeTransactionResult = {
        user: {
          id: 1,
          name: 'John',
          userName: 'john@abcd',
          email: null,
          imageUrl: 'default-avatar.png',
          role: { name: 'USER' },
          createdAt: new Date(),
        },
        profile: { phoneNumber: null, address: null, dob: null },
        authProvider: { id: 10 },
      };
      (_prismaMock.client.$transaction as jest.Mock).mockImplementation(
        async (cb: (tx: typeof _prismaMock.client) => Promise<unknown>) =>
          cb({
            user: { create: jest.fn().mockResolvedValue(fakeTransactionResult.user) },
            authProvider: {
              create: jest.fn().mockResolvedValue(fakeTransactionResult.authProvider),
            },
            userProfile: { create: jest.fn().mockResolvedValue(fakeTransactionResult.profile) },
          } as unknown as typeof _prismaMock.client),
      );
      const result = await service.create({ ...baseDto });
      expect(result.statusKey).toBe(StatusKey.SUCCESS);
      expect(result.data).toEqual(
        expect.objectContaining({
          id: 1,
          name: 'John',
          role: 'USER',
        }),
      );
      expect(_prismaMock.client.$transaction).toHaveBeenCalled();
    });
    it('should throw validation error if dto is invalid', async () => {
      const invalidDto: UserByEmailRequest = { email: 'invalid-email' } as UserByEmailRequest;
      const rpcError = {
        code: HTTP_ERROR_CODE.BAD_REQUEST,
        message: 'common.errors.validationError',
      } as const;
      jest
        .spyOn(classValidator, 'validateOrReject')
        .mockRejectedValueOnce(new TypedRpcException(rpcError));
      try {
        await service.getUserByEmail(invalidDto);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
      }
    });
    it('should throw conflict error when phone exists', async () => {
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (_prismaMock.client.userProfile.findUnique as jest.Mock).mockResolvedValue({ id: 99 });
      await expect(service.create({ ...baseDto, phone: '0123456789' })).rejects.toEqual(
        new TypedRpcException({
          code: HTTP_ERROR_CODE.CONFLICT,
          message: 'common.user.phoneNumberExist',
        }),
      );
    });
    it('should throw conflict error when email exists', async () => {
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (_prismaMock.client.userProfile.findUnique as jest.Mock).mockResolvedValue(null);
      (_prismaMock.client.user.findUnique as jest.Mock).mockResolvedValue({ id: 100 });
      await expect(service.create({ ...baseDto, email: 'exist@mail.com' })).rejects.toEqual(
        new TypedRpcException({
          code: HTTP_ERROR_CODE.CONFLICT,
          message: 'common.user.emailExist',
        }),
      );
    });
    it('should throw TypedRpcException when prisma error occurs', async () => {
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (_prismaMock.client.userProfile.findUnique as jest.Mock).mockResolvedValue(null);
      (_prismaMock.client.user.findUnique as jest.Mock).mockResolvedValue(null);
      const prismaError = new Error('db');
      (_prismaMock.client.$transaction as jest.Mock).mockRejectedValue(prismaError);
      const mappedError = new TypedRpcException({
        code: HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        message: 'common.errors.internalServerError',
      });
      jest.spyOn(prismaClientError, 'handlePrismaError').mockImplementation(() => {
        throw mappedError;
      });
      await expect(service.create({ ...baseDto })).rejects.toBe(mappedError);
      expect(handlePrismaError).toHaveBeenCalledWith(
        prismaError,
        'UserService',
        'create',
        expect.anything(),
      );
    });
    it('should throw validation error when dto is invalid', async () => {
      const rpcError = {
        code: HTTP_ERROR_CODE.BAD_REQUEST,
        message: 'common.errors.validationError',
      } as const;
      jest
        .spyOn(classValidator, 'validateOrReject')
        .mockRejectedValueOnce(new TypedRpcException(rpcError));
      try {
        await service.create({} as unknown as UserCreationRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
      }
    });
  });
  describe('update Roles', () => {
    const dto: UserUpdateRoleRequest = {
      users: [
        { userId: 1, role: RoleUpdate.ADMIN },
        { userId: 2, role: RoleUpdate.USER },
      ],
    };
    afterEach(() => {
      (classValidator.validateOrReject as jest.Mock).mockResolvedValue(undefined);
    });
    it('should validate dto, update roles and return mapped response', async () => {
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (_prismaMock.client.user.findMany as jest.Mock).mockResolvedValueOnce([
        { id: 1, role: 'USER' },
        { id: 2, role: 'ADMIN' },
      ]);
      const updatedUsers = [
        {
          id: 1,
          name: 'User A',
          userName: 'usera',
          email: 'a@mail.com',
          isActive: true,
          imageUrl: null,
          status: 'ACTIVE',
          role: { name: 'ADMIN' },
          profile: null,
        },
        {
          id: 2,
          name: 'User B',
          userName: 'userb',
          email: 'b@mail.com',
          isActive: false,
          imageUrl: null,
          status: 'INACTIVE',
          role: { name: 'USER' },
          profile: { phoneNumber: null, address: null },
        },
      ];
      (_prismaMock.client.$transaction as jest.Mock).mockResolvedValueOnce(updatedUsers);
      const result = await service.updateRoles(dto);
      expect(_prismaMock.client.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] } },
        select: { id: true, role: { select: { name: true } } },
      });
      expect(_prismaMock.client.$transaction).toHaveBeenCalled();
      expect(result.statusKey).toBe(StatusKey.SUCCESS);
      expect(result.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 1, role: 'ADMIN' }),
          expect.objectContaining({ id: 2, role: 'USER' }),
        ]),
      );
    });

    it('should propagate validation error', async () => {
      const rpcError = {
        code: HTTP_ERROR_CODE.BAD_REQUEST,
        message: 'common.errors.validationError',
      } as const;
      jest
        .spyOn(classValidator, 'validateOrReject')
        .mockRejectedValueOnce(new TypedRpcException(rpcError));
      try {
        await service.updateRoles(dto);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.BAD_REQUEST);
      }
    });

    it('should throw NOT_FOUND when some users not exist', async () => {
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (_prismaMock.client.user.findMany as jest.Mock).mockResolvedValueOnce([{ id: 1 }]);
      await expect(service.updateRoles(dto)).rejects.toEqual(
        new TypedRpcException({
          code: HTTP_ERROR_CODE.NOT_FOUND,
          message: 'common.user.someUserNotExist',
          args: { missingIds: '2' },
        }),
      );
    });
    it('should propagate prisma error via handlePrismaError', async () => {
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (_prismaMock.client.user.findMany as jest.Mock).mockResolvedValueOnce([
        { id: 1, role: 'USER' },
        { id: 2, role: 'ADMIN' },
      ]);
      const prismaError = new Error('db fail');
      (_prismaMock.client.$transaction as jest.Mock).mockRejectedValueOnce(prismaError);
      const mappedError = new TypedRpcException({
        code: HTTP_ERROR_CODE.CONFLICT,
        message: 'common.errors.uniqueConstraint',
      });
      jest.spyOn(prismaClientError, 'handlePrismaError').mockImplementationOnce(() => {
        throw mappedError;
      });
      await expect(service.updateRoles(dto)).rejects.toBe(mappedError);
      expect(prismaClientError.handlePrismaError).toHaveBeenCalledWith(
        prismaError,
        'UserService',
        'updateRoles',
        expect.anything(),
      );
    });

    it('should return UNCHANGED when no user roles require updating', async () => {
      const prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      // Mock DB roles that already match incoming dto
      (prismaMock.client.user.findMany as jest.Mock).mockResolvedValueOnce([
        { id: 1, role: { name: 'ADMIN' } },
        { id: 2, role: { name: 'USER' } },
      ]);

      const result = await service.updateRoles(dto);

      expect(result).toEqual({ statusKey: StatusKey.UNCHANGED, data: [] });
      expect(prismaMock.client.$transaction).not.toHaveBeenCalled();
    });
  });
  describe('update statuses', () => {
    const dto: UserUpdateStatusRequest = {
      users: [
        { userId: 1, status: UserStatus.ACTIVE },
        { userId: 2, status: UserStatus.INACTIVE },
      ],
    };
    beforeEach(() => {
      jest.clearAllMocks();
      (classValidator.validateOrReject as jest.Mock).mockResolvedValue(undefined);
    });
    // afterEach(() => {
    //   (classValidator.validateOrReject as jest.Mock).mockResolvedValue(undefined);
    // });
    it('should validate dto, update statuses and return mapped response', async () => {
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (_prismaMock.client.user.findMany as jest.Mock).mockResolvedValueOnce([
        { id: 1, status: 'INACTIVE' },
        { id: 2, status: 'ACTIVE' },
      ]);
      const updatedUsers = [
        {
          id: 1,
          name: 'User A',
          userName: 'usera',
          email: 'a@mail.com',
          isActive: true,
          imageUrl: null,
          status: 'ACTIVE',
          role: { name: 'USER' },
          profile: null,
        },
        {
          id: 2,
          name: 'User B',
          userName: 'userb',
          email: 'b@mail.com',
          isActive: false,
          imageUrl: null,
          status: 'INACTIVE',
          role: { name: 'ADMIN' },
          profile: { phoneNumber: null, address: null },
        },
      ];
      (_prismaMock.client.$transaction as jest.Mock).mockResolvedValueOnce(updatedUsers);
      const result = await service.updateStatuses(dto);
      expect(_prismaMock.client.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] } },
        select: { id: true, status: true },
      });
      expect(_prismaMock.client.$transaction).toHaveBeenCalled();
      expect(result.statusKey).toBe(StatusKey.SUCCESS);
      expect(result.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 1, status: 'ACTIVE' }),
          expect.objectContaining({ id: 2, status: 'INACTIVE' }),
        ]),
      );
    });

    it('should propagate validation error', async () => {
      const rpcError = {
        code: HTTP_ERROR_CODE.BAD_REQUEST,
        message: 'common.errors.validationError',
      } as const;
      jest
        .spyOn(classValidator, 'validateOrReject')
        .mockRejectedValueOnce(new TypedRpcException(rpcError));
      try {
        await service.updateStatuses(dto);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.BAD_REQUEST);
      }
    });

    it('should throw NOT_FOUND when some users do not exist', async () => {
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (_prismaMock.client.user.findMany as jest.Mock).mockResolvedValueOnce([{ id: 1 }]);
      await expect(service.updateStatuses(dto)).rejects.toEqual(
        new TypedRpcException({
          code: HTTP_ERROR_CODE.NOT_FOUND,
          message: 'common.user.someUserNotExist',
          args: { missingIds: '2' },
        }),
      );
    });

    it('should propagate prisma error via handlePrismaError', async () => {
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (_prismaMock.client.user.findMany as jest.Mock).mockResolvedValueOnce([
        { id: 1, status: 'INACTIVE' },
        { id: 2, status: 'ACTIVE' },
      ]);
      const prismaError = new Error('db fail');
      (_prismaMock.client.$transaction as jest.Mock).mockRejectedValueOnce(prismaError);
      const mappedError = new TypedRpcException({
        code: HTTP_ERROR_CODE.CONFLICT,
        message: 'common.errors.rowNotFound',
      });
      jest.spyOn(prismaClientError, 'handlePrismaError').mockImplementationOnce(() => {
        throw mappedError;
      });
      await expect(service.updateStatuses(dto)).rejects.toBe(mappedError);
      expect(prismaClientError.handlePrismaError).toHaveBeenCalledWith(
        prismaError,
        'UserService',
        'updateStatuses',
        expect.anything(),
      );
    });

    it('should return status unchanged if no users had their status changed', async () => {
      const _prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      (_prismaMock.client.user.findMany as jest.Mock).mockResolvedValueOnce([
        { id: 1, status: 'ACTIVE' },
        { id: 2, status: 'INACTIVE' },
      ]);
      const unchangedUsers = [
        {
          id: 1,
          name: 'User A',
          userName: 'usera',
          email: 'a@mail.com',
          isActive: true,
          imageUrl: null,
          status: 'ACTIVE',
          role: { name: 'USER' },
          profile: null,
        },
        {
          id: 2,
          name: 'User B',
          userName: 'userb',
          email: 'b@mail.com',
          isActive: false,
          imageUrl: null,
          status: 'INACTIVE',
          role: { name: 'ADMIN' },
          profile: { phoneNumber: null, address: null },
        },
      ];
      (_prismaMock.client.$transaction as jest.Mock).mockResolvedValueOnce(unchangedUsers);
      const result = await service.updateStatuses(dto);
      expect(result.statusKey).toBe(StatusKey.UNCHANGED);
      expect(result.data).toEqual([]);
    });
  });
  describe('delete user', () => {
    const dto: SoftDeleteUserRequest = { userId: 1 } as SoftDeleteUserRequest;
    let prismaMock: PrismaService<PrismaClient>;
    let productProducerMock: jest.Mocked<ProductProducer>;

    beforeEach(() => {
      jest.clearAllMocks();
      (classValidator.validateOrReject as jest.Mock).mockResolvedValue(undefined);
      prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      productProducerMock = moduleRef.get(ProductProducer);
    });

    it('should propagate validation error', async () => {
      const rpcError = {
        code: HTTP_ERROR_CODE.BAD_REQUEST,
        message: 'common.errors.validationError',
      } as const;
      jest
        .spyOn(classValidator, 'validateOrReject')
        .mockRejectedValueOnce(new TypedRpcException(rpcError));
      try {
        await service.delete(dto);
      } catch (error) {
        expect(error).toBeInstanceOf(TypedRpcException);
        expect((error as TypedRpcException).getError()).toEqual(rpcError);
        expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.BAD_REQUEST);
      }
    });

    it('should throw NOT_FOUND when user does not exist', async () => {
      (prismaMock.client.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
      await expect(service.delete(dto)).rejects.toEqual(
        new TypedRpcException({
          code: HTTP_ERROR_CODE.NOT_FOUND,
          message: 'common.user.notFound',
        }),
      );
    });

    it('should return UNCHANGED when user already deleted', async () => {
      const deletedUser = { id: 1, deletedAt: new Date() };
      (prismaMock.client.user.findUnique as jest.Mock).mockResolvedValueOnce(deletedUser);
      const result = await service.delete(dto);
      expect(result.statusKey).toBe(StatusKey.UNCHANGED);
      expect(prismaMock.client.user.update).not.toHaveBeenCalled();
      expect(productProducerMock.addJobSoftDeleteCart).not.toHaveBeenCalled();
    });

    it('should soft delete user and enqueue cart deletion job', async () => {
      const foundUser = { id: 1, deletedAt: null };
      const updatedUser = { id: 1, deletedAt: new Date() };
      (prismaMock.client.user.findUnique as jest.Mock).mockResolvedValueOnce(foundUser);
      (prismaMock.client.user.update as jest.Mock).mockResolvedValueOnce(updatedUser);
      const result = await service.delete(dto);
      expect(prismaMock.client.user.update).toHaveBeenCalledWith({
        where: { id: dto.userId },
        data: { deletedAt: expect.any(Date) },
      });
      expect(productProducerMock.addJobSoftDeleteCart).toHaveBeenCalledWith({
        userId: updatedUser.id,
      });
      expect(result.statusKey).toBe(StatusKey.SUCCESS);
      const payload = result.data as SoftDeleteUserResponse;
      expect(payload.userId).toBe(updatedUser.id);
      expect(payload.deletedAt).toBeInstanceOf(Date);
    });

    it('should propagate prisma error via handlePrismaError', async () => {
      const foundUser = { id: 1, deletedAt: null };
      (prismaMock.client.user.findUnique as jest.Mock).mockResolvedValueOnce(foundUser);
      const prismaError = new Error('db error');
      (prismaMock.client.user.update as jest.Mock).mockRejectedValueOnce(prismaError);
      const mappedError = new TypedRpcException({
        code: HTTP_ERROR_CODE.CONFLICT,
        message: 'common.errors.rowNotFound',
      });
      jest.spyOn(prismaClientError, 'handlePrismaError').mockImplementationOnce(() => {
        throw mappedError;
      });
      await expect(service.delete(dto)).rejects.toBe(mappedError);
      expect(prismaClientError.handlePrismaError).toHaveBeenCalledWith(
        prismaError,
        'UserService',
        'delete',
        expect.anything(),
      );
    });

    it('should soft delete userProfile when profile exists', async () => {
      const prismaMock = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
      const productProducerMock = moduleRef.get(ProductProducer);

      (prismaMock.client.user.findUnique as jest.Mock).mockResolvedValueOnce({
        id: dto.userId,
        deletedAt: null,
      });
      // Mock user update response
      (prismaMock.client.user.update as jest.Mock).mockResolvedValueOnce({
        id: dto.userId,
        deletedAt: new Date(),
      });

      (prismaMock.client.userProfile.findUnique as jest.Mock).mockResolvedValueOnce({ id: 42 });
      (prismaMock.client.userProfile as unknown as { update: jest.Mock }).update = jest
        .fn()
        .mockResolvedValueOnce({ id: 42, deletedAt: new Date() });

      const result = await service.delete(dto);

      expect(prismaMock.client.userProfile.update).toHaveBeenCalledWith({
        where: { userId: dto.userId },
        data: { deletedAt: expect.any(Date) },
      });
      expect(productProducerMock.addJobSoftDeleteCart).toHaveBeenCalledWith({
        userId: dto.userId,
      });
      expect(result.statusKey).toBe(StatusKey.SUCCESS);
    });
  });
});
