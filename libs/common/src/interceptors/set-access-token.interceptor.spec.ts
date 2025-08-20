import { ConfigService } from '@nestjs/config';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { SetAccessTokenInterceptor } from './set-access-token.interceptor';
import { StatusKey } from '../enums/status-key.enum';
import { Response } from 'express';
import { UserResponse } from '../dto/user/responses/user.response';

const createMockContext = (response: Response): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({}),
      getNext: () => null,
    }),
  }) as unknown as ExecutionContext;

describe('SetAccessTokenInterceptor', () => {
  let interceptor: SetAccessTokenInterceptor;
  let configService: ConfigService;
  let resMock: Response;
  let cookieMock: jest.Mock;
  beforeEach(() => {
    const getMock = jest.fn((_: string, def: unknown) => def);
    configService = { get: getMock } as unknown as ConfigService;
    interceptor = new SetAccessTokenInterceptor(configService);
    cookieMock = jest.fn();
    resMock = { cookie: cookieMock } as unknown as Response;
  });

  it('should set cookie when accessToken exists', (done) => {
    const context = createMockContext(resMock);
    type PayloadSuccess = {
      statusKey: StatusKey;
      data: { accessToken: string; user: UserResponse };
    };
    const payload: PayloadSuccess = {
      statusKey: StatusKey.SUCCESS,
      data: {
        accessToken: 'token123',
        user: {
          id: 1,
          name: 'Test',
          userName: 'test',
          createdAt: new Date(),
          role: 'user',
          status: 'ACTIVE',
          deletedAt: null,
          authProviders: [],
        },
      },
    };

    const handler: CallHandler<PayloadSuccess> = { handle: () => of(payload) };
    interceptor.intercept(context, handler).subscribe((result) => {
      expect(cookieMock).toHaveBeenCalledWith(
        'token',
        'token123',
        expect.objectContaining({ maxAge: 3600 * 1000 }),
      );
      expect(result).toEqual(payload);
      done();
    });
  });

  it('should NOT set cookie when accessToken missing', (done) => {
    const context = createMockContext(resMock);
    type PayloadNoToken = { statusKey: StatusKey; data: { user: unknown } };
    const payload: PayloadNoToken = {
      statusKey: StatusKey.SUCCESS,
      data: { user: {} },
    };
    const handler: CallHandler<PayloadNoToken> = { handle: () => of(payload) };
    interceptor.intercept(context, handler).subscribe((result) => {
      expect(cookieMock).not.toHaveBeenCalled();
      expect(result).toEqual(payload);
      done();
    });
  });
});
