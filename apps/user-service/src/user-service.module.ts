import { Module } from '@nestjs/common';
import { UserService } from './user-service.service';
import { PrismaModule } from '@app/prisma';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AcceptLanguageResolver, I18nJsonLoader, I18nModule } from 'nestjs-i18n';
import * as path from 'path';
import configuration from '../configuration';
import { PrismaClient } from '../generated/prisma';
import { UserServiceController } from './user-service.controller';
import { I18nRpcValidationPipe } from '@app/common/pipes/rpc-validation-pipe';
import { APP_PIPE } from '@nestjs/core';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { ProductProducer } from './producer/product.producer';
import { BullModule } from '@nestjs/bull';
import { QueueName } from '@app/common/enums/queue/queue-name.enum';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(process.cwd(), 'apps/user-service/.env'),
      load: [configuration],
    }),
    PrismaModule.forRoot({
      isGlobal: true,
      client: PrismaClient,
    }),
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: QueueName.PRODUCT,
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(process.cwd(), 'libs/common/src/locales/'),
        watch: true,
      },
      loader: I18nJsonLoader,
      resolvers: [
        {
          use: AcceptLanguageResolver,
          options: ['x-custom-lang'],
        },
      ],
    }),
  ],
  controllers: [UserServiceController],
  providers: [
    UserService,
    {
      provide: APP_PIPE,
      useClass: I18nRpcValidationPipe,
    },
    CustomLogger,
    UserService,
    ProductProducer,
  ],
  exports: [],
})
export class UserServiceModule {}
