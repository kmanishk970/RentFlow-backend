import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    // Feature modules land here as each is built:
    //   AuthModule, OwnersModule, PropertiesModule, PeopleModule,
    //   LeasesModule, BillingModule, DocumentsModule, NotificationsModule,
    //   ReportsModule
  ],
})
export class AppModule {}
