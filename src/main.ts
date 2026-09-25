import 'reflect-metadata';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';

/**
 * Whether an origin is loopback or a private-network address, on any port.
 *
 * Only consulted in development, where the app is opened from a phone or
 * another machine on the LAN as often as from the one running it.
 *
 * Parsed rather than pattern-matched: URL handles the bracketed IPv6 form and
 * the port for us, and the address ranges read as the rules they are.
 */
function isPrivateNetwork(origin: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return true;
  }

  const octets = hostname.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  ) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 10 ||
    (first === 192 && second === 168) ||
    (first === 172 && second >= 16 && second <= 31)
  );
}

/**
 * Decides which origins may read a response.
 *
 * CORS_ORIGIN takes a comma-separated list, and that list is the whole answer
 * in production. In development the private-network addresses are allowed on
 * top, because otherwise opening the app on the machine's LAN IP fails with a
 * blocked response and no useful error.
 */
function allowedOrigin(configured: string | undefined, isDev: boolean) {
  const list = (configured ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void,
  ) => {
    // No Origin header at all: curl, a server-side call, a same-origin request.
    if (!origin) return callback(null, true);
    if (list.includes(origin)) return callback(null, true);
    if (isDev && isPrivateNetwork(origin)) return callback(null, true);

    // Declined, not errored. Throwing here turns a refused origin into a 500
    // with a stack trace in the log; omitting the header is what CORS expects
    // and the browser blocks the response either way.
    return callback(null, false);
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Helmet defaults Cross-Origin-Resource-Policy to same-origin, which makes a
  // browser discard the response even when CORS allowed the request — the
  // frontend sees a network failure with no status. An API served to a browser
  // on another origin has to say so. curl ignores CORP entirely, so this is
  // invisible to anything but a real browser.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // No HTML is served from here, so the CSP only gets in the way of the
      // Swagger page.
      contentSecurityPolicy: false,
    }),
  );
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.enableCors({
    origin: allowedOrigin(
      config.get<string>('corsOrigin'),
      config.get<string>('nodeEnv') !== 'production',
    ),
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
