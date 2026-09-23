import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

import { Notification } from './entities/notification.model';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification) private readonly notifications: typeof Notification,
  ) {}

  findAll(ownerId: string, unreadOnly = false) {
    return this.notifications.findAll({
      where: { ownerId, ...(unreadOnly ? { readAt: { [Op.is]: null } } : {}) },
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
  }

  /** What the bell in the header needs, without pulling the list. */
  unreadCount(ownerId: string) {
    return this.notifications.count({
      where: { ownerId, readAt: { [Op.is]: null } },
    });
  }

  async markRead(ownerId: string, id: string) {
    const notification = await this.notifications.findOne({
      where: { id, ownerId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    // Already-read stays at its original timestamp: when it was first read is
    // the useful fact, not when it was last clicked.
    if (!notification.readAt) await notification.update({ readAt: new Date() });
    return notification;
  }

  async markAllRead(ownerId: string) {
    const [updated] = await this.notifications.update(
      { readAt: new Date() },
      { where: { ownerId, readAt: { [Op.is]: null } } },
    );
    return { updated };
  }
}
