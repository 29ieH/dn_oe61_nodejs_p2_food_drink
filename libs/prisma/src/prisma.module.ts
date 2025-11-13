import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PRISMA_CLIENT } from './prisma.constants';
import { PrismaClientWithLifecycle } from '@app/common/types/prisma.type';
import { PrismaModuleOptions } from '@app/common/interfaces/prisma.interface';

@Global()
@Module({})
export class PrismaModule {
  static forRoot<T extends PrismaClientWithLifecycle>(
    options: PrismaModuleOptions<T>,
  ): DynamicModule {
    const prismaClientProvider: Provider = {
      provide: PRISMA_CLIENT,
      useClass: options.client,
    };

    const prismaServiceProvider: Provider = {
      provide: PrismaService,
      useFactory: (client: T) => {
        return new PrismaService(client);
      },
      inject: [PRISMA_CLIENT],
    };

    return {
      global: options.isGlobal ?? false,
      module: PrismaModule,
      providers: [prismaClientProvider, prismaServiceProvider],
      exports: [PrismaService],
    };
  }
}
