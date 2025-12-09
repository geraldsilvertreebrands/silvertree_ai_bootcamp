# PHASE2-010: Slack Integration (Real)

## Context

Replace the mock notification adapter with real Slack integration. This enables automatic notifications to managers and system owners when workflow actions are needed.

## Acceptance Criteria

- [ ] **Slack App Setup:**
  - [ ] Document Slack app creation process
  - [ ] Required scopes: `chat:write`, `users:read`, `users:read.email`
  - [ ] Bot token stored in environment variable

- [ ] **Slack Adapter Implementation:**
  - [ ] Create `SlackNotificationAdapter` implementing `INotificationService`
  - [ ] Use `@slack/web-api` package
  - [ ] Look up Slack user ID from email
  - [ ] Send direct messages to users
  - [ ] Include action buttons in messages

- [ ] **User Slack Mapping:**
  - [ ] Add `slackUserId` field to User entity (optional)
  - [ ] Fallback to email lookup if not set
  - [ ] Cache Slack user lookups

- [ ] **Message Templates:**
  - [ ] Request approval message (to manager)
  - [ ] Approved message (to system owners)
  - [ ] Rejected message (to requester)
  - [ ] Activated message (to requester)
  - [ ] To-remove message (to system owners)
  - [ ] Removed message (to requester)

- [ ] **Error Handling:**
  - [ ] Graceful failure (don't block main operation)
  - [ ] Log failures for debugging
  - [ ] Retry logic for transient failures
  - [ ] Handle missing Slack users gracefully

## Technical Approach

### 1. Install Dependencies
```bash
npm install @slack/web-api
```

### 2. Slack Adapter
```typescript
// src/integrations/notifications/slack-notification.adapter.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebClient } from '@slack/web-api';
import { INotificationService, NotificationContext } from './notification.interface';

@Injectable()
export class SlackNotificationAdapter implements INotificationService {
  private readonly logger = new Logger(SlackNotificationAdapter.name);
  private readonly client: WebClient;
  private readonly userIdCache = new Map<string, string>();

  constructor(private configService: ConfigService) {
    const token = this.configService.get<string>('SLACK_BOT_TOKEN');
    this.client = new WebClient(token);
  }

  async notifyManager(context: NotificationContext): Promise<void> {
    const { grant, link } = context;

    try {
      const managerEmail = grant.user?.manager?.email;
      if (!managerEmail) {
        this.logger.warn(`No manager email for user ${grant.userId}`);
        return;
      }

      const slackUserId = await this.lookupSlackUser(managerEmail);
      if (!slackUserId) return;

      await this.client.chat.postMessage({
        channel: slackUserId,
        text: `Access request needs your approval`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '📋 Access Request',
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${grant.requestedBy?.name}* has requested access for *${grant.user?.name}*`,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*System:*\n${grant.systemInstance?.system?.name}`,
              },
              {
                type: 'mrkdwn',
                text: `*Instance:*\n${grant.systemInstance?.name}`,
              },
              {
                type: 'mrkdwn',
                text: `*Access Level:*\n${grant.accessTier?.name}`,
              },
              {
                type: 'mrkdwn',
                text: `*Justification:*\n${grant.justification || 'None provided'}`,
              },
            ],
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Review Request' },
                url: link,
                style: 'primary',
              },
            ],
          },
        ],
      });

      this.logger.log(`Sent approval request to ${managerEmail}`);
    } catch (error) {
      this.logger.error(`Failed to notify manager: ${error.message}`);
    }
  }

  async notifySystemOwners(context: NotificationContext): Promise<void> {
    const { grant, action, link } = context;

    try {
      // Get system owners
      const systemOwners = grant.systemInstance?.system?.owners || [];

      for (const owner of systemOwners) {
        const slackUserId = await this.lookupSlackUser(owner.user.email);
        if (!slackUserId) continue;

        const actionText = action === 'approve'
          ? 'needs provisioning'
          : 'needs to be removed';

        await this.client.chat.postMessage({
          channel: slackUserId,
          text: `Access ${actionText}`,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: action === 'approve' ? '✅ Provision Access' : '🗑️ Remove Access',
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `Access for *${grant.user?.name}* to *${grant.systemInstance?.system?.name}* ${actionText}`,
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Instance:*\n${grant.systemInstance?.name}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Access Level:*\n${grant.accessTier?.name}`,
                },
              ],
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'View in Dashboard' },
                  url: link,
                  style: 'primary',
                },
              ],
            },
          ],
        });
      }

      this.logger.log(`Notified ${systemOwners.length} system owners`);
    } catch (error) {
      this.logger.error(`Failed to notify system owners: ${error.message}`);
    }
  }

  async notifyRequester(context: NotificationContext): Promise<void> {
    const { grant, action, reason, link } = context;

    try {
      const requesterEmail = grant.requestedBy?.email;
      if (!requesterEmail) return;

      const slackUserId = await this.lookupSlackUser(requesterEmail);
      if (!slackUserId) return;

      let emoji = '📋';
      let title = 'Request Update';
      let message = '';

      switch (action) {
        case 'approve':
          emoji = '✅';
          title = 'Request Approved';
          message = `Your access request for *${grant.user?.name}* has been approved and is pending provisioning.`;
          break;
        case 'reject':
          emoji = '❌';
          title = 'Request Rejected';
          message = `Your access request for *${grant.user?.name}* has been rejected.\n*Reason:* ${reason}`;
          break;
        case 'activate':
          emoji = '🎉';
          title = 'Access Granted';
          message = `Access has been provisioned for *${grant.user?.name}*.`;
          break;
        case 'remove':
          emoji = '🗑️';
          title = 'Access Removed';
          message = `Access has been removed for *${grant.user?.name}*.`;
          break;
      }

      await this.client.chat.postMessage({
        channel: slackUserId,
        text: title,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: `${emoji} ${title}` },
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: message },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*System:*\n${grant.systemInstance?.system?.name}`,
              },
              {
                type: 'mrkdwn',
                text: `*Access Level:*\n${grant.accessTier?.name}`,
              },
            ],
          },
        ],
      });
    } catch (error) {
      this.logger.error(`Failed to notify requester: ${error.message}`);
    }
  }

  private async lookupSlackUser(email: string): Promise<string | null> {
    // Check cache first
    if (this.userIdCache.has(email)) {
      return this.userIdCache.get(email);
    }

    try {
      const result = await this.client.users.lookupByEmail({ email });
      const userId = result.user?.id;

      if (userId) {
        this.userIdCache.set(email, userId);
        return userId;
      }
    } catch (error) {
      this.logger.warn(`Could not find Slack user for ${email}: ${error.message}`);
    }

    return null;
  }
}
```

### 3. Environment Variables
```env
ENABLE_SLACK=true
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
```

### 4. Module Update
```typescript
// src/integrations/integrations.module.ts
{
  provide: NOTIFICATION_SERVICE,
  useFactory: (configService: ConfigService) => {
    const enableSlack = configService.get<string>('ENABLE_SLACK') === 'true';

    if (enableSlack) {
      return new SlackNotificationAdapter(configService);
    }

    return new MockNotificationAdapter();
  },
  inject: [ConfigService],
}
```

## Agents to Use

| Step | Agent | Purpose |
|------|-------|---------|
| 1 | `/integration` | Design Slack adapter |
| 2 | `/backend` | Implement Slack adapter |
| 3 | `/backend` | Update module configuration |
| 4 | `/testing` | Test with real Slack workspace |
| 5 | `/docs` | Document setup process |

## Tests

- **Integration (with test Slack workspace):**
  - [ ] Manager receives approval request message
  - [ ] System owners receive provisioning notification
  - [ ] Requester receives approval notification
  - [ ] Requester receives rejection notification with reason
  - [ ] Requester receives activation notification
  - [ ] Action buttons link to correct pages
  - [ ] Graceful handling when user not in Slack
  - [ ] Caching works for user lookups

## Dependencies

- PHASE2-006 (Notification interface must exist)

## Progress

- YYYY-MM-DD: Ticket created

## Notes

- Requires Slack workspace admin to create app
- Test in development workspace first
- Consider rate limiting for bulk operations
- Future: Add interactive buttons for approve/reject directly in Slack
