import { USER_SERVICE } from '@app/common/constant/service.constant';
import { LoginRequestDto } from '@app/common/dto/auth/requests/login.request.';
import { LoginResponse } from '@app/common/dto/auth/responses/login.response';
import { ProfileFacebookUser } from '@app/common/dto/user/requests/facebook-user-dto.request';
import { UserByEmailRequest } from '@app/common/dto/user/requests/user-by-email.request';
import { UserResponse } from '@app/common/dto/user/responses/user.response';
import { HTTP_ERROR_CODE } from '@app/common/enums/errors/http-error-code';
import { UserMsgPattern } from '@app/common/enums/message-patterns/user.pattern';
import { StatusKey } from '@app/common/enums/status-key.enum';
import { TypedRpcException } from '@app/common/exceptions/rpc-exceptions';
import { callMicroservice } from '@app/common/helpers/microservices';
import { BaseResponse } from '@app/common/interfaces/data-type';
import { AccessTokenPayload } from '@app/common/interfaces/token-payload';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { buildBaseResponse } from '@app/common/utils/data.util';
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Provider } from 'apps/user-service/generated/prisma';
import * as bcrypt from 'bcrypt';
import { validateOrReject } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { JsonWebTokenError, JwtService, TokenExpiredError } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import { TUserPayload } from '@app/common/types/user-payload.type';
import { RETRIES_DEFAULT, TIMEOUT_MS_DEFAULT } from '@app/common/constant/rpc.constants';
import { PayLoadJWT } from '@app/common/dto/user/sign-token.dto';
import { UserStatus } from '@app/common/enums/user-status.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(USER_SERVICE) private readonly userClient: ClientProxy,
    private readonly loggerService: CustomLogger,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginRequestDto): Promise<BaseResponse<LoginResponse>> {
    await validateOrReject(Object.assign(new LoginRequestDto(), dto));
    const getUserByEmailRequestDto: UserByEmailRequest = {
      email: dto.email,
    };
    const userByEmail = await callMicroservice(
      this.userClient.send<UserResponse | null>(
        UserMsgPattern.USER_GET_BY_EMAIL,
        getUserByEmailRequestDto,
      ),
      USER_SERVICE,
      this.loggerService,
      {
        timeoutMs: 3000,
        retries: 2,
      },
    );
    if (!userByEmail)
      throw new TypedRpcException({
        code: HTTP_ERROR_CODE.UNAUTHORIZED,
        message: 'common.auth.invalidCredentials',
      });
    if (userByEmail.status === UserStatus.INACTIVE.toString()) {
      throw new TypedRpcException({
        code: HTTP_ERROR_CODE.UNAUTHORIZED,
        message: 'common.auth.inactiveAccount',
      });
    }
    if (userByEmail.deletedAt) {
      throw new TypedRpcException({
        code: HTTP_ERROR_CODE.UNAUTHORIZED,
        message: 'common.auth.invalidCredentials',
      });
    }
    const passwordLocal = userByEmail.authProviders?.find(
      (p) => p.provider === Provider.LOCAL,
    )?.password;
    if (!passwordLocal)
      throw new TypedRpcException({
        code: HTTP_ERROR_CODE.UNAUTHORIZED,
        message: 'common.auth.invalidCredentials',
      });
    const hasMatchPassword = await this.comparePassword(dto.password, passwordLocal);
    if (!hasMatchPassword)
      throw new TypedRpcException({
        code: HTTP_ERROR_CODE.UNAUTHORIZED,
        message: 'common.auth.invalidCredentials',
      });
    const accessToken = await this.generateAccessToken(userByEmail);
    const payload: LoginResponse = this.buildLoginResponse(accessToken, userByEmail);
    return buildBaseResponse(StatusKey.SUCCESS, payload);
  }
  async loginFromFacebook(dto: ProfileFacebookUser): Promise<BaseResponse<LoginResponse>> {
    await validateOrReject(Object.assign(new ProfileFacebookUser(), dto));
    const userDetail = await callMicroservice<UserResponse>(
      this.userClient.send(UserMsgPattern.FIND_OR_CREATE_USER_FROM_FACEBOOK, dto),
      USER_SERVICE,
      this.loggerService,
      {
        timeoutMs: TIMEOUT_MS_DEFAULT,
        retries: RETRIES_DEFAULT,
      },
    );
    const accessToken = await this.generateAccessToken(userDetail);
    const payload: LoginResponse = this.buildLoginResponse(accessToken, userDetail);
    return buildBaseResponse(StatusKey.SUCCESS, payload);
  }

  async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }
  async generateAccessToken(user: UserResponse): Promise<string> {
    const payload: AccessTokenPayload = {
      id: user.id,
      email: user?.email ?? '',
      role: user.role,
    };
    try {
      return await this.jwtService.signAsync(payload);
    } catch (error) {
      this.loggerService.error(
        '[SIGN ACCESS-TOKEN ERROR]',
        `details error:: ${(error as Error).stack}`,
      );
      throw new TypedRpcException({
        code: HTTP_ERROR_CODE.INTERNAL_SERVER_ERROR,
        message: 'common.errors.internalServerError',
      });
    }
  }
  async validateToken(token: string): Promise<TUserPayload> {
    if (!token) {
      throw new RpcException('common.errors.registerUser.notToken');
    }

    try {
      return await this.jwtService.verifyAsync<TUserPayload>(token, {
        secret: this.configService.get<string>('jwt.secretKey'),
      });
    } catch (error) {
      if (error instanceof TokenExpiredError || error instanceof JsonWebTokenError) {
        throw new RpcException('common.guard.invalid_or_expired_token');
      }
      throw error;
    }
  }
  buildLoginResponse(accessToken: string, user: UserResponse): LoginResponse {
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email ?? '',
        name: user.name,
        role: user.role,
      },
    };
  }

  async signJwtToken(data: PayLoadJWT): Promise<LoginResponse> {
    if (!data) {
      throw new RpcException('common.auth.action.signToken.error');
    }

    const secretValue = this.configService.get<string | number>('jwt.secretKey');
    const secret =
      secretValue !== undefined && secretValue !== null ? String(secretValue) : undefined;

    if (!secret) {
      throw new RpcException('common.auth.action.signToken.error');
    }

    try {
      const accessToken = await this.jwtService.signAsync(data, { secret });
      if (!accessToken) {
        throw new RpcException('common.auth.action.signToken.error');
      }

      const payload: LoginResponse = this.buildLoginResponse(accessToken, data);
      return payload;
    } catch {
      throw new RpcException('common.auth.action.signToken.error');
    }
  }

  async signJwtTokenUserCreate(data: PayLoadJWT): Promise<string> {
    if (!data) {
      throw new RpcException('common.auth.action.signJwtTokenUserCreate.error');
    }

    const secretValue = this.configService.get<string | number>('jwt.secretKey');
    const secret =
      secretValue !== undefined && secretValue !== null ? String(secretValue) : undefined;

    if (!secret) {
      throw new RpcException('common.auth.action.signJwtTokenUserCreate.error');
    }

    try {
      const accessToken = await this.jwtService.signAsync(data, { secret });
      if (!accessToken) {
        throw new RpcException('common.auth.action.signJwtTokenUserCreate.error');
      }

      return accessToken;
    } catch {
      throw new RpcException('common.auth.action.signJwtTokenUserCreate.error');
    }
  }
}
