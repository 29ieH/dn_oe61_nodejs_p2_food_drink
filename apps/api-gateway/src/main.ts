import { swaggerConfig } from '@app/common/swagger/swagger.config';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { ApiGatewayModule } from './api-gateway.module';
import * as cookieParser from 'cookie-parser';
import * as session from 'express-session';
import * as passport from 'passport';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);
  const configService = app.get(ConfigService);
  app.use(cookieParser());
  app.use(
    session({
      secret: (() => {
        const sessionSecret = configService.get<string>('session.secret');
        if (!sessionSecret) {
          throw new Error('Session secret is not defined');
        }
        return sessionSecret;
      })(),
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());
  passport.serializeUser((user, done) => {
    done(null, user);
  });
  const port = configService.get<number>('app.port');
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document);
  await app.listen(port ?? 3000);
  console.log(`API Gateway listening on port ${port ?? 3000}`);
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
