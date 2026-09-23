import 'reflect-metadata';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.enableCors({
    origin: config.get<string>('corsOrigin'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // Anything not on the DTO is dropped rather than quietly persisted, and
      // sending an unknown field is an error rather than a silent no-op.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  if (config.get<string>('nodeEnv') !== 'production') {
    const spec = new DocumentBuilder()
      .setTitle('RentFlow API')
      .setDescription('Property, tenancy and rent ledger')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, spec),
    );
  }

  const port = config.get<number>('port') ?? 4000;
  await app.listen(port);

  const log = new Logger('Bootstrap');
  log.log(`RentFlow API listening on :${port}/api/v1`);
  log.log(`Docs at :${port}/api/docs`);
}

void bootstrap();
