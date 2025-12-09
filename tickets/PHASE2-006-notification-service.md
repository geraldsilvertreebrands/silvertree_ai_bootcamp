# PHASE2-006: Notification Service (Stub)

## Context

The workflow requires notifications at various status transitions. This ticket implements the notification service using the adapter pattern, starting with a mock/stub implementation that logs to console. Real Slack integration will be added in PHASE2-010.

## Acceptance Criteria

- [ ] **Notification Interface:**
  - [ ] Define `INotificationService` interface
  - [ ] Methods: `notifyManager`, `notifySystemOwners`, `notifyRequester`
  - [ ] Use dependency injection token pattern

- [ ] **Mock Adapter:**
  - [ ] Create `MockNotificationAdapter` that implements interface
  - [ ] Log all notification calls to console with full details
  - [ ] Format logs to be easily readable for testing

- [ ] **Module Configuration:**
  - [ ] Create `IntegrationsModule`
  - [ ] Use factory to choose adapter based on `ENABLE_SLACK` env var
  - [ ] Default to mock adapter when Slack is disabled

- [ ] **Notification Triggers:**
  - [ ] Inject notification service into AccessGrantService
  - [ ] Trigger notifications at status transitions:
    - `requested` → Notify manager
    - `approved` → Notify system owners
    - `rejected` → Notify requester
    - `active` → Notify requester
    - `to_remove` → Notify system owners
    - `removed` → Notify requester

- [ ] **Deep Link Generation:**
  - [ ] Create helper to generate deep links
  - [ ] Use `APP_BASE_URL` environment variable
  - [ ] Links for: approval page, grant details, user dashboard

## Technical Approach

### 1. Interface Definition
```typescript
// src/integrations/notifications/notification.interface.ts
import { AccessGrant } from '../../access-control/entities/access-grant.entity';

export interface NotificationContext {
  grant: AccessGrant;
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
```

### 2. Mock Adapter
```typescript
// src/integrations/notifications/mock-notification.adapter.ts
import { Injectable, Logger } from '@nestjs/common';
import { INotificationService, NotificationContext } from './notification.interface';

@Injectable()
export class MockNotificationAdapter implements INotificationService {
  private readonly logger = new Logger('Notifications');

  async notifyManager(context: NotificationContext): Promise<void> {
    const { grant, action, link } = context;
    this.logger.log('========== NOTIFICATION ==========');
    this.logger.log(`TO: Manager of ${grant.user?.name} (${grant.user?.email})`);
    this.logger.log(`ACTION: ${action}`);
    this.logger.log(`GRANT: ${grant.user?.name} → ${grant.systemInstance?.name} (${grant.accessTier?.name})`);
    if (link) this.logger.log(`LINK: ${link}`);
    this.logger.log('==================================');
  }

  async notifySystemOwners(context: NotificationContext): Promise<void> {
    const { grant, action, link } = context;
    this.logger.log('========== NOTIFICATION ==========');
    this.logger.log(`TO: System owners of ${grant.systemInstance?.system?.name}`);
    this.logger.log(`ACTION: ${action}`);
    this.logger.log(`GRANT: ${grant.user?.name} → ${grant.systemInstance?.name} (${grant.accessTier?.name})`);
    if (link) this.logger.log(`LINK: ${link}`);
    this.logger.log('==================================');
  }

  async notifyRequester(context: NotificationContext): Promise<void> {
    const { grant, action, link, reason } = context;
    this.logger.log('========== NOTIFICATION ==========');
    this.logger.log(`TO: Requester ${grant.requestedBy?.name} (${grant.requestedBy?.email})`);
    this.logger.log(`ACTION: ${action}`);
    this.logger.log(`GRANT: ${grant.user?.name} → ${grant.systemInstance?.name} (${grant.accessTier?.name})`);
    if (reason) this.logger.log(`REASON: ${reason}`);
    if (link) this.logger.log(`LINK: ${link}`);
    this.logger.log('==================================');
  }
}
```

### 3. Module Configuration
```typescript
// src/integrations/integrations.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NOTIFICATION_SERVICE } from './notifications/notification.interface';
import { MockNotificationAdapter } from './notifications/mock-notification.adapter';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: NOTIFICATION_SERVICE,
      useFactory: (configService: ConfigService) => {
        const enableSlack = configService.get<string>('ENABLE_SLACK') === 'true';

        if (enableSlack) {
          // Will be implemented in PHASE2-010
          // return new SlackNotificationAdapter(configService);
        }

        return new MockNotificationAdapter();
      },
      inject: [ConfigService],
    },
  ],
  exports: [NOTIFICATION_SERVICE],
})
export class IntegrationsModule {}
```

### 4. Deep Link Helper
```typescript
// src/integrations/notifications/deep-link.helper.ts
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DeepLinkHelper {
  private readonly baseUrl: string;

  constructor(configService: ConfigService) {
    this.baseUrl = configService.get<string>('APP_BASE_URL', 'http://localhost:3000');
  }

  approvalLink(grantId: string): string {
    return `${this.baseUrl}/approvals/${grantId}`;
  }

  grantDetailsLink(grantId: string): string {
    return `${this.baseUrl}/grants/${grantId}`;
  }

  pendingProvisioningLink(): string {
    return `${this.baseUrl}/pending-provisioning`;
  }

  pendingRemovalLink(): string {
    return `${this.baseUrl}/pending-removal`;
  }
}
```

### 5. Integration in AccessGrantService
```typescript
// In AccessGrantService constructor
constructor(
  @Inject(NOTIFICATION_SERVICE)
  private readonly notificationService: INotificationService,
  private readonly deepLinkHelper: DeepLinkHelper,
  // ... other deps
) {}

// In createRequest method, after saving:
if (grant.status === AccessGrantStatus.REQUESTED) {
  await this.notificationService.notifyManager({
    grant: savedGrant,
    action: 'request',
    link: this.deepLinkHelper.approvalLink(savedGrant.id),
  });
}

// In approveRequest method:
await this.notificationService.notifySystemOwners({
  grant: savedGrant,
  action: 'approve',
  link: this.deepLinkHelper.pendingProvisioningLink(),
});

// ... similar for other transitions
```

## Agents to Use

| Step | Agent | Purpose |
|------|-------|---------|
| 1 | `/integration` | Design notification adapter pattern |
| 2 | `/backend` | Create interface and mock adapter |
| 3 | `/backend` | Create module and deep link helper |
| 4 | `/backend` | Integrate into AccessGrantService |
| 5 | `/testing` | Write tests verifying notifications are triggered |

## Tests

- **Integration:**
  - [ ] Creating request triggers manager notification (check logs)
  - [ ] Approving request triggers system owner notification
  - [ ] Rejecting request triggers requester notification with reason
  - [ ] Activating grant triggers requester notification
  - [ ] Marking to_remove triggers system owner notification
  - [ ] Marking removed triggers requester notification
  - [ ] Deep links are correctly formatted
  - [ ] Mock adapter logs all expected information

## Dependencies

- PHASE2-002 (Access requests exist)
- PHASE2-003 (Approval flow exists)
- PHASE2-004 (Provisioning flow exists)
- PHASE2-005 (Removal flow exists)

## Progress

- YYYY-MM-DD: Ticket created

## Notes

- This is a STUB implementation - logs to console only
- Real Slack integration in PHASE2-010
- Notifications should NOT fail the main operation (graceful degradation)
- Use try/catch around notification calls
- Environment variable: `ENABLE_SLACK=false` (default)
