import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { ReportsService } from './reports.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('dashboard')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'The dashboard tiles, as numbers',
    description:
      'Computed in Postgres. The alternative is downloading every bill and payment to add them up in the browser.',
  })
  summary(@CurrentUser('ownerId') ownerId: string) {
    return this.reports.summary(ownerId);
  }

  @Get('trend')
  @ApiQuery({ name: 'months', required: false, example: 6 })
  @ApiOperation({ summary: 'Billed against collected, by month' })
  trend(
    @CurrentUser('ownerId') ownerId: string,
    @Query('months', new DefaultValuePipe(6), ParseIntPipe) months: number,
  ) {
    return this.reports.monthlyTrend(ownerId, Math.min(Math.max(months, 1), 24));
  }
}
