import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { SequelizeModule } from '@nestjs/sequelize';

import { Owner } from '../owners/entities/owner.model';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

/**
 * Global so the JWT guard below can be registered here rather than in
 * AppModule: a provider bound to APP_GUARD resolves its dependencies from the
 * module that declares it, and this is where JwtService and the Owner model
 * already live.
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    SequelizeModule.forFeature([Owner]),
    // Secrets are passed per-sign rather than registered here, because access
    // and refresh tokens are signed with different ones.
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService, JwtModule, SequelizeModule],
})
export class AuthModule {}
