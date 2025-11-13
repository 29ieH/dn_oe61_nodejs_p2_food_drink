import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { USER_SERVICE } from '@app/common/constant/service.constant';

@Injectable()
export class AuthService {
  constructor(@Inject(USER_SERVICE) private readonly userClient: ClientProxy) {}
}
