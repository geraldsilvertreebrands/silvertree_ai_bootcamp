import { Injectable, Logger } from '@nestjs/common';
import { INotificationService, NotificationContext } from './notification.interface';

@Injectable()
export class MockNotificationAdapter implements INotificationService {
  private readonly logger = new Logger('Notifications');

  async notifyManager(context: NotificationContext): Promise<void> {
    const { request, action, link } = context;
    this.logger.log('========== NOTIFICATION ==========');
    this.logger.log(`TO: Manager of ${request.targetUser?.name} (${request.targetUser?.email})`);
    this.logger.log(`ACTION: ${action}`);
    this.logger.log(`REQUEST: ${request.targetUser?.name} → ${request.items?.[0]?.systemInstance?.name || 'N/A'} (${request.items?.[0]?.accessTier?.name || 'N/A'})`);
    if (link) this.logger.log(`LINK: ${link}`);
    this.logger.log('==================================');
  }

  async notifySystemOwners(context: NotificationContext): Promise<void> {
    const { request, action, link } = context;
    this.logger.log('========== NOTIFICATION ==========');
    this.logger.log(`TO: System owners of ${request.items?.[0]?.systemInstance?.system?.name || 'N/A'}`);
    this.logger.log(`ACTION: ${action}`);
    this.logger.log(`REQUEST: ${request.targetUser?.name} → ${request.items?.[0]?.systemInstance?.name || 'N/A'} (${request.items?.[0]?.accessTier?.name || 'N/A'})`);
    if (link) this.logger.log(`LINK: ${link}`);
    this.logger.log('==================================');
  }

  async notifyRequester(context: NotificationContext): Promise<void> {
    const { request, action, link, reason } = context;
    this.logger.log('========== NOTIFICATION ==========');
    this.logger.log(`TO: Requester ${request.requester?.name} (${request.requester?.email})`);
    this.logger.log(`ACTION: ${action}`);
    this.logger.log(`REQUEST: ${request.targetUser?.name} → ${request.items?.[0]?.systemInstance?.name || 'N/A'} (${request.items?.[0]?.accessTier?.name || 'N/A'})`);
    if (reason) this.logger.log(`REASON: ${reason}`);
    if (link) this.logger.log(`LINK: ${link}`);
    this.logger.log('==================================');
  }
}



