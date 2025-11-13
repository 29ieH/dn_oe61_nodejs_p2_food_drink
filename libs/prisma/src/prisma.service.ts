import { Injectable, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import { PRISMA_CLIENT } from './prisma.constants';
import { PrismaClientWithLifecycle } from '@app/common/types/prisma.type';

@Injectable()
export class PrismaService<T extends PrismaClientWithLifecycle>
  implements OnModuleInit, OnModuleDestroy
{
  constructor(@Inject(PRISMA_CLIENT) public readonly client: T) {}

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
