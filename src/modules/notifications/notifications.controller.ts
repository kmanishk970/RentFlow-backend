import { Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiQuery({ name: 'unread', required: false, type: Boolean })
  findAll(
    @CurrentUser('ownerId') ownerId: string,
    @Query('unread') unread?: string,
  ) {
    return this.notifications.findAll(ownerId, unread === 'true');
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Just the badge number' })
  async unreadCount(@CurrentUser('ownerId') ownerId: string) {
    return { count: await this.notifications.unreadCount(ownerId) };
  }

  @Patch('read-all')
  markAllRead(@CurrentUser('ownerId') ownerId: string) {
    return this.notifications.markAllRead(ownerId);
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser('ownerId') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(ownerId, id);
  }
}
