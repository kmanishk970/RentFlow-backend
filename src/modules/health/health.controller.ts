import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

import { Public } from '../../common/decorators/public.decorator';

/**
 * Is the server up, and can it reach its database?
 *
 * Open on purpose. Two things need it and neither can hold a token: the host's
 * own health check, which restarts the service when it fails, and the pinger
 * that keeps a free instance from being stopped for idleness.
 *
 * The database is part of the answer. A process that answers HTTP while its
 * connection is gone is not healthy — it is a service that will fail every
 * real request while reporting itself fine.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Liveness, including the database connection' })
  async check() {
    try {
      await this.sequelize.query('SELECT 1');
      return { status: 'ok', database: 'up' };
    } catch {
      return { status: 'degraded', database: 'down' };
    }
  }
}
