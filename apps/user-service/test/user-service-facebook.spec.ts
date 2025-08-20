import { ProfileFacebookUser } from '@app/common/dto/user/requests/facebook-user-dto.request';
import { UserResponse } from '@app/common/dto/user/responses/user.response';
import { HTTP_ERROR_CODE } from '@app/common/enums/errors/http-error-code';
import { TypedRpcException } from '@app/common/exceptions/rpc-exceptions';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { PrismaService } from '@app/prisma';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as classValidator from 'class-validator';
import { AuthProvider, PrismaClient, Provider, StatusUser } from '../generated/prisma';
import { INCLUDE_AUTH_PROVIDER_USER } from '../src/constants/include-auth-user';
import { UserService } from '../src/user-service.service';
import { ConfigService } from '@nestjs/config';
import { ProductProducer } from '../src/producer/product.producer';

describe('UserService – Facebook login', () => {
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
              },
              authProvider: {
                findUnique: jest.fn(),
                create: jest.fn(),
              },
              $transaction: jest.fn(),
            },
          },
        },
        { provide: CustomLogger, useValue: { error: jest.fn(), log: jest.fn() } },
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
    jest.spyOn(classValidator, 'validateOrReject').mockResolvedValue(undefined as never);
  });

  const profile: ProfileFacebookUser = {
    providerId: 'fb-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
  } as ProfileFacebookUser;

  it('should throw validation error when DTO invalid', async () => {
    const rpcError = {
      code: HTTP_ERROR_CODE.BAD_REQUEST,
      message: 'common.errors.validationError',
    } as const;
    jest
      .spyOn(classValidator, 'validateOrReject')
      .mockRejectedValueOnce(new TypedRpcException(rpcError));

    try {
      await expect(service.findOrCreateUserFromFacebook(profile)).rejects.toBeInstanceOf(
        TypedRpcException,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(TypedRpcException);
      expect((error as TypedRpcException).getError()).toEqual(rpcError);
      expect((error as TypedRpcException).getError().code).toEqual(HTTP_ERROR_CODE.BAD_REQUEST);
    }
  });

  it('returns existing user when Facebook provider already exists', async () => {
    const prisma = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
    const providerDetail = {
      id: 10,
      provider: Provider.FACEBOOK,
      providerId: profile.providerId,
      user: {
        id: 99,
        name: 'John Doe',
        userName: 'john@abcd',
        email: profile.email,
        imageUrl: '',
        createdAt: new Date(),
        updatedAt: null,
        role: { name: 'USER' },
        authProviders: [],
      },
    };
    const authProviderSpy = (
      prisma.client.authProvider.findUnique as jest.Mock
    ).mockResolvedValueOnce(providerDetail);
    const result = await service.findOrCreateUserFromFacebook(profile);
    expect(result.id).toBe(providerDetail.user.id);
    expect(authProviderSpy).toHaveBeenCalledWith({
      where: { providerId: profile.providerId, provider: Provider.FACEBOOK },
      include: INCLUDE_AUTH_PROVIDER_USER,
    });
  });

  it('creates new user & provider when none exist', async () => {
    const prisma = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
    (prisma.client.authProvider.findUnique as jest.Mock).mockResolvedValueOnce(null);
    jest.spyOn(service, 'getUserByEmail').mockResolvedValueOnce(null);
    const created = {
      id: 1,
      provider: Provider.FACEBOOK,
      providerId: profile.providerId,
      user: {
        id: 100,
        name: 'John Doe',
        userName: 'doe@abcd',
        email: profile.email,
        imageUrl: '',
        createdAt: new Date(),
        updatedAt: null,
        role: { name: 'USER' },
        authProviders: [
          {
            id: 1,
            provider: Provider.FACEBOOK,
            providerId: profile.providerId,
            user: 100,
          },
        ],
      },
    };
    const createUserAndProivderSpy = (
      prisma.client.$transaction as jest.Mock
    ).mockResolvedValueOnce(created);
    const result = await service.findOrCreateUserFromFacebook(profile);
    expect(createUserAndProivderSpy).toHaveBeenCalled();
    expect(result.id).toBe(created.user.id);
    expect(result.name).toBe(created.user.name);
    expect(result.authProviders?.some((p: AuthProvider) => p.provider === Provider.FACEBOOK)).toBe(
      true,
    );
  });

  it('should propagate error when transaction creating user & provider fails', async () => {
    const prisma = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
    (prisma.client.authProvider.findUnique as jest.Mock).mockResolvedValueOnce(null);
    jest.spyOn(service, 'getUserByEmail').mockResolvedValueOnce(null);
    const rpcError = new TypedRpcException({
      code: HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
      message: 'common.errors.internalServerError',
    });
    (prisma.client.$transaction as jest.Mock).mockRejectedValueOnce(rpcError);
    await expect(service.findOrCreateUserFromFacebook(profile)).rejects.toBeInstanceOf(
      TypedRpcException,
    );
  });

  it('links Facebook provider to existing user lacking it', async () => {
    const prisma = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
    (prisma.client.authProvider.findUnique as jest.Mock).mockResolvedValueOnce(null);
    const existingUser = {
      id: 55,
      name: 'Jane',
      userName: 'jane@abcd',
      email: profile.email,
      imageUrl: '',
      createdAt: new Date(),
      updatedAt: null,
      role: 'USER',
      isActive: true,
      authProviders: [{ id: 1, provider: Provider.LOCAL, password: 'hash' }],
    } as UserResponse;
    jest.spyOn(service, 'getUserByEmail').mockResolvedValueOnce(existingUser);
    const providerCreated = {
      id: 21,
      provider: Provider.FACEBOOK,
      providerId: profile.providerId,
      user: {
        ...existingUser,
        authProviders: [
          ...(existingUser.authProviders ?? []),
          { id: 21, provider: Provider.FACEBOOK },
        ],
      },
    };
    const authProviderSpy = (prisma.client.authProvider.create as jest.Mock).mockResolvedValueOnce(
      providerCreated,
    );
    const result = await service.findOrCreateUserFromFacebook(profile);
    expect(authProviderSpy).toHaveBeenCalled();
    expect(result.id).toBe(existingUser.id);
    expect(result.authProviders?.some((p) => p.provider === Provider.FACEBOOK)).toBe(true);
  });

  it('should propagate error when linking facebook provider fails', async () => {
    const prisma = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
    (prisma.client.authProvider.findUnique as jest.Mock).mockResolvedValueOnce(null);
    const existingUser = {
      id: 10,
      name: 'Jack',
      userName: 'jack@abcd',
      email: profile.email,
      imageUrl: '',
      createdAt: new Date(),
      updatedAt: null,
      deletedAt: null,
      role: 'USER',
      status: 'ACTIVE',
      isActive: true,
      authProviders: [],
    } as UserResponse;
    jest.spyOn(service, 'getUserByEmail').mockResolvedValueOnce(existingUser);

    const rpcError = new TypedRpcException({
      code: HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
      message: 'common.errors.internalServerError',
    });
    (prisma.client.authProvider.create as jest.Mock).mockRejectedValueOnce(rpcError);
    await expect(service.findOrCreateUserFromFacebook(profile)).rejects.toBeInstanceOf(
      TypedRpcException,
    );
  });

  it('propagates Prisma unique constraint as conflict error', async () => {
    const prisma = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
    (prisma.client.authProvider.findUnique as jest.Mock).mockResolvedValueOnce(null);
    jest.spyOn(service, 'getUserByEmail').mockResolvedValueOnce(null);
    (prisma.client.$transaction as jest.Mock).mockRejectedValueOnce({ code: 'P2002' });
    await expect(service.findOrCreateUserFromFacebook(profile)).rejects.toBeInstanceOf(
      TypedRpcException,
    );
  });

  it('calls tx.user.create when creating new user & provider', async () => {
    const prisma = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
    (prisma.client.authProvider.findUnique as jest.Mock).mockResolvedValueOnce(null);
    jest.spyOn(service, 'getUserByEmail').mockResolvedValueOnce(null);
    const txUserCreateSpy = jest.spyOn(prisma.client.user, 'create');
    const txAuthCreateSpy = jest.spyOn(prisma.client.authProvider, 'create');
    const stubUser = {
      id: 123,
      name: 'John Doe',
      userName: 'john@abcd',
      status: StatusUser.ACTIVE,
      email: profile.email ?? null,
      imageUrl: '',
      createdAt: new Date(),
      updatedAt: null,
      deletedAt: null,
      roleId: 1,
      role: { name: 'USER' },
      isActive: true,
    };
    const stubProvider = {
      id: 10,
      provider: Provider.FACEBOOK,
      providerId: profile.providerId,
      userId: stubUser.id,
      status: StatusUser.ACTIVE,
      user: { ...stubUser, authProviders: [] },
      password: null,
      createdAt: new Date(),
      updatedAt: null,
    };
    txUserCreateSpy.mockResolvedValueOnce(stubUser);
    txAuthCreateSpy.mockResolvedValueOnce(stubProvider);

    (prisma.client.$transaction as jest.Mock).mockImplementationOnce(
      (cb: (tx: PrismaClient) => Promise<unknown>) => cb(prisma.client),
    );
    await service.findOrCreateUserFromFacebook(profile);
    expect(txUserCreateSpy).toHaveBeenCalled();
    expect(txAuthCreateSpy).toHaveBeenCalled();
  });

  it('maps Prisma error from transaction to TypedRpcException', async () => {
    const prisma = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
    (prisma.client.authProvider.findUnique as jest.Mock).mockResolvedValueOnce(null);
    jest.spyOn(service, 'getUserByEmail').mockResolvedValueOnce(null);

    const prismaErr = new PrismaClientKnownRequestError('fail', {
      code: '202',
      clientVersion: '1.0.0',
    });
    (prisma.client.$transaction as jest.Mock).mockRejectedValueOnce(prismaErr);

    await expect(service.findOrCreateUserFromFacebook(profile)).rejects.toBeInstanceOf(
      TypedRpcException,
    );
  });

  it('maps Prisma error when linking facebook provider', async () => {
    const prisma = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
    (prisma.client.authProvider.findUnique as jest.Mock).mockResolvedValueOnce(null);
    const existing = {
      id: 4,
      name: 'Test',
      userName: 'test@abcd',
      authProviders: [],
      createdAt: new Date(),
      updatedAt: null,
      deletedAt: null,
      role: 'USER',
      isActive: true,
      status: 'ACTIVE',
    } as UserResponse;
    jest.spyOn(service, 'getUserByEmail').mockResolvedValueOnce(existing);
    const prismaErr = new PrismaClientKnownRequestError('Fail', {
      code: 'P2002',
      clientVersion: '1.0.0',
    });
    (prisma.client.authProvider.create as jest.Mock).mockRejectedValueOnce(prismaErr);
    await expect(service.findOrCreateUserFromFacebook(profile)).rejects.toBeInstanceOf(
      TypedRpcException,
    );
  });

  it('returns user unchanged when facebook provider already linked', async () => {
    const prisma = moduleRef.get<PrismaService<PrismaClient>>(PrismaService);
    (prisma.client.authProvider.findUnique as jest.Mock).mockResolvedValueOnce(null);
    const existing = {
      id: 99,
      name: 'Linked',
      userName: 'linked@abcd',
      email: profile.email,
      imageUrl: '',
      createdAt: new Date(),
      updatedAt: null,
      role: 'USER',
      isActive: true,
      authProviders: [{ id: 3, provider: Provider.FACEBOOK }],
    } as UserResponse;
    const createSpy = jest.spyOn(prisma.client.authProvider, 'create');
    jest.spyOn(service, 'getUserByEmail').mockResolvedValueOnce(existing);
    const res = await service.findOrCreateUserFromFacebook(profile);
    expect(res).toStrictEqual(existing);
    expect(createSpy).not.toHaveBeenCalled();
  });
});
