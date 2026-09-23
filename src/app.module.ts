import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';

import { DatabaseExceptionFilter } from './common/filters/database-exception.filter';

import { AuthModule } from './modules/auth/auth.module';
import { PropertiesModule } from './modules/properties/properties.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),

    // A floor under every route. Auth endpoints tighten it further.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),

    DatabaseModule,

    AuthModule,
    PropertiesModule,
  ],
  providers: [
    // The JWT guard is registered inside AuthModule, where its dependencies
    // live. Routes are closed by default; @Public() is the exception.
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // Constraint violations become the status codes they deserve: an
    // overlapping lease is a 409, not a 500.
    { provide: APP_FILTER, useClass: DatabaseExceptionFilter },
  ],
})
export class AppModule {}
