import { AccessRequest } from '../../access-control/entities/access-request.entity';

export interface NotificationContext {
  request: AccessRequest;
  action: 'request' | 'approve' | 'reject' | 'activate' | 'to_remove' | 'remove';
  link?: string;
  reason?: string;
}

export interface INotificationService {
  notifyManager(context: NotificationContext): Promise<void>;
  notifySystemOwners(context: NotificationContext): Promise<void>;
  notifyRequester(context: NotificationContext): Promise<void>;
}

export const NOTIFICATION_SERVICE = Symbol('NOTIFICATION_SERVICE');




