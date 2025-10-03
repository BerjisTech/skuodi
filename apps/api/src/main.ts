/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app/app.module';
import { configuration } from './app/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidUnknownValues: true,
    })
  );

  const configService = app.get<ConfigService<ReturnType<typeof configuration>, true>>(ConfigService);
  const corsOrigin = configService.get('http.corsOrigin', { infer: true }) ?? '*';
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  const port = configService.get('http.port', { infer: true }) ?? 3001;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
