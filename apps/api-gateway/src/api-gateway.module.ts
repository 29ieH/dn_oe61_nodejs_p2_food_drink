import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AcceptLanguageResolver, I18nJsonLoader, I18nModule } from 'nestjs-i18n';
import * as path from 'path';
import configuration from '../configuration';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  AUTH_SERVICE,
  USER_SERVICE,
  PRODUCT_SERVICE,
  NOTIFICATION_SERVICE,
} from '@app/common/constant/service.constant';
import { TransformDataInterceptor } from '@app/common/interceptors/transform-data.interceptor';
import { CustomLogger } from '@app/common/logger/custom-logger.service';
import { GlobalExceptionFilter } from '@app/common/filters/global-exceptions.filter';
import { I18nHttpValidationPipe } from '@app/common/pipes/http-validation-pipe';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { FacebookStrategy } from './auth/strategy/facebook.stragety';
import { PassportModule } from '@nestjs/passport';
import { TwitterStrategy } from './auth/strategy/twitter.strategy';
import { GoogleStrategy } from './auth/strategy/google-strategy';
import { AdminUserController } from './user/admin-user.controller';
import { UserService } from './user/user.service';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from '@app/common/enums/queue/queue-name.enum';
import { ProductController } from './product/product.controller';
import { ProductService } from './product/product.service';
import { CloudinaryConsoleModule } from '@app/common/cloudinary/cloudinary.module';
import { CloudinaryModule } from 'libs/cloudinary/cloudinary.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(process.cwd(), 'apps/api-gateway/.env'),
      load: [configuration],
    }),
    BullModule.registerQueue({
      name: QueueName.CLOUDINARY,
    }),
    ClientsModule.registerAsync([
      {
        name: AUTH_SERVICE,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.REDIS,
          options: {
            host: configService.get<string>('REDIS_HOST'),
            port: configService.get<number>('REDIS_PORT'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: USER_SERVICE,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.REDIS,
          options: {
            host: configService.get<string>('REDIS_HOST'),
            port: configService.get<number>('REDIS_PORT'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: PRODUCT_SERVICE,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.REDIS,
          options: {
            host: configService.get<string>('REDIS_HOST'),
            port: configService.get<number>('REDIS_PORT'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: NOTIFICATION_SERVICE,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.REDIS,
          options: {
            host: configService.get<string>('REDIS_HOST'),
            port: configService.get<number>('REDIS_PORT'),
          },
        }),
        inject: [ConfigService],
      },
    ]),
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
    PassportModule.register({ session: true }),
    CloudinaryConsoleModule,
    CloudinaryModule,
  ],
  controllers: [AuthController, AdminUserController, ProductController],
  providers: [
    AuthService,
    ProductService,
    CustomLogger,
    UserService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformDataInterceptor,
    },
    {
      provide: APP_PIPE,
      useClass: I18nHttpValidationPipe,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    FacebookStrategy,
    TwitterStrategy,
    GoogleStrategy,
  ],
})
export class ApiGatewayModule {}
