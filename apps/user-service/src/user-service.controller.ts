import { UserByEmailRequest } from '@app/common/dto/user/requests/user-by-email.request';
import { UserResponse } from '@app/common/dto/user/responses/user.response';
import { UserMsgPattern } from '@app/common/enums/message-patterns/user.pattern';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UserService } from './user-service.service';
import { ProfileFacebookUser } from '@app/common/dto/user/requests/facebook-user-dto.request';
import { CreateUserDto } from '@app/common/dto/user/create-user.dto';
import { UserCreationRequest } from '@app/common/dto/user/requests/user-creation.request';
import { UserUpdateRoleRequest } from '@app/common/dto/user/requests/user-update-role.request';
import { UserUpdateStatusRequest } from '@app/common/dto/user/requests/user-update-status.request';
import { SoftDeleteUserRequest } from '@app/common/dto/user/requests/soft-delete-user.request';

@Controller()
export class UserServiceController {
  constructor(private readonly userService: UserService) {}
  @MessagePattern(UserMsgPattern.USER_GET_BY_EMAIL)
  async findUserByEmail(@Payload() dto: UserByEmailRequest): Promise<UserResponse | null> {
    return this.userService.getUserByEmail(dto);
  }
  @MessagePattern(UserMsgPattern.FIND_OR_CREATE_USER_FROM_FACEBOOK)
  async findOrCreateUserFromFacebook(
    @Payload() dto: ProfileFacebookUser,
  ): Promise<UserResponse | null> {
    return this.userService.findOrCreateUserFromFacebook(dto);
  }

  @MessagePattern({ cmd: UserMsgPattern.CHECK_USER_EXISTS })
  async checkUserExists(@Payload() providerId: string) {
    const result = await this.userService.checkUserExists(providerId);
    return result;
  }

  @MessagePattern({ cmd: UserMsgPattern.CREATE_OAUTH_USER })
  async createUser(@Payload() data: CreateUserDto): Promise<UserResponse | null> {
    const result = await this.userService.validateOAuthUserCreation(data);
    return result;
  }

  @MessagePattern(UserMsgPattern.REGISTER_USER)
  async register(@Payload() data: CreateUserDto): Promise<UserResponse | null> {
    const result = await this.userService.createUserWithPassword(data);
    return result;
  }

  @MessagePattern(UserMsgPattern.CHANGE_IS_ACTIVE)
  async changeIsActive(@Payload() user: UserResponse): Promise<UserResponse | null> {
    return await this.userService.changeIsActive(user);
  }
  @MessagePattern(UserMsgPattern.ADMIN_CREATE_USER)
  async adminCreateUser(@Payload() dto: UserCreationRequest) {
    return await this.userService.create(dto);
  }
  @MessagePattern(UserMsgPattern.ADMIN_UPDATE_ROLE)
  async adminUpdateRole(@Payload() dto: UserUpdateRoleRequest) {
    return await this.userService.updateRoles(dto);
  }
  @MessagePattern(UserMsgPattern.ADMIN_UPDATE_STATUS)
  async adminUpdateStatus(@Payload() dto: UserUpdateStatusRequest) {
    return await this.userService.updateStatuses(dto);
  }
  @MessagePattern(UserMsgPattern.ADMIN_DELETE_USER)
  async adminDeleteUser(@Payload() dto: SoftDeleteUserRequest) {
    return await this.userService.delete(dto);
  }
}
