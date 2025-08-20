import { RETRIES_DEFAULT, TIMEOUT_MS_DEFAULT } from '@app/common/constant/rpc.constants';
import { USER_SERVICE } from '@app/common/constant/service.constant';
import { SoftDeleteUserRequest } from '@app/common/dto/user/requests/soft-delete-user.request';
import { UserCreationRequest } from '@app/common/dto/user/requests/user-creation.request';
import { UserUpdateRoleRequest } from '@app/common/dto/user/requests/user-update-role.request';
import { UserUpdateStatusRequest } from '@app/common/dto/user/requests/user-update-status.request';
import { SoftDeleteUserResponse } from '@app/common/dto/user/responses/soft-delete-user.response';
import { UserCreationResponse } from '@app/common/dto/user/responses/user-creation.response';
import { UserSummaryResponse } from '@app/common/dto/user/responses/user-summary.response';
import { UserMsgPattern } from '@app/common/enums/message-patterns/user.pattern';
import { callMicroservice } from '@app/common/helpers/microservices';
import { BaseResponse } from '@app/common/interfaces/data-type';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_SERVICE) private readonly userClient: ClientProxy,
    private readonly loggerService: CustomLogger,
  ) {}
  async create(dto: UserCreationRequest): Promise<BaseResponse<UserCreationResponse>> {
    await validateOrReject(dto);
    return await callMicroservice(
      this.userClient.send<BaseResponse<UserCreationResponse>>(
        UserMsgPattern.ADMIN_CREATE_USER,
        dto,
      ),
      USER_SERVICE,
      this.loggerService,
      {
        timeoutMs: TIMEOUT_MS_DEFAULT,
        retries: RETRIES_DEFAULT,
      },
    );
  }
  async updateRoles(dto: UserUpdateRoleRequest): Promise<BaseResponse<UserSummaryResponse[]>> {
    const dtoInstance = plainToInstance(UserUpdateRoleRequest, dto);
    await validateOrReject(dtoInstance);
    return await callMicroservice(
      this.userClient.send<BaseResponse<UserSummaryResponse[]>>(
        UserMsgPattern.ADMIN_UPDATE_ROLE,
        dto,
      ),
      USER_SERVICE,
      this.loggerService,
      {
        timeoutMs: TIMEOUT_MS_DEFAULT,
        retries: RETRIES_DEFAULT,
      },
    );
  }
  async updateStatuses(dto: UserUpdateStatusRequest): Promise<BaseResponse<UserSummaryResponse[]>> {
    const dtoInstance = plainToInstance(UserUpdateStatusRequest, dto);
    await validateOrReject(dtoInstance);
    return await callMicroservice(
      this.userClient.send<BaseResponse<UserSummaryResponse[] | []>>(
        UserMsgPattern.ADMIN_UPDATE_STATUS,
        dto,
      ),
      USER_SERVICE,
      this.loggerService,
      {
        timeoutMs: TIMEOUT_MS_DEFAULT,
        retries: RETRIES_DEFAULT,
      },
    );
  }
  async delete(dto: SoftDeleteUserRequest): Promise<BaseResponse<SoftDeleteUserResponse>> {
    const dtoInstance = plainToInstance(SoftDeleteUserRequest, dto);
    await validateOrReject(dtoInstance);
    return await callMicroservice(
      this.userClient.send<BaseResponse<SoftDeleteUserResponse>>(
        UserMsgPattern.ADMIN_DELETE_USER,
        dto,
      ),
      USER_SERVICE,
      this.loggerService,
      {
        timeoutMs: TIMEOUT_MS_DEFAULT,
        retries: RETRIES_DEFAULT,
      },
    );
  }
}
