import { NestFactory } from '@nestjs/core';
import { NotificationServiceModule } from './notification-service.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(NotificationServiceModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port');
  await app.listen(port ?? 3000);
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
