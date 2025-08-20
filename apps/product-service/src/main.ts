import { NestFactory } from '@nestjs/core';
import { ProductServiceModule } from './product-service.module';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(ProductServiceModule);
  const configService = app.get(ConfigService);
  app.connectMicroservice({
    transport: Transport.REDIS,
    options: {
      host: configService.get<string>('redis.host'),
      port: configService.get<number>('redis.port'),
    },
  });

  await app.startAllMicroservices();
  await app.init();
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
