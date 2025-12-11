import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebClient } from '@slack/web-api';
import { INotificationService, NotificationContext } from './notification.interface';
import { SystemOwnerService } from '../../ownership/services/system-owner.service';

@Injectable()
export class SlackNotificationAdapter implements INotificationService {
  private readonly logger = new Logger(SlackNotificationAdapter.name);
  private readonly client: WebClient;
  private readonly userIdCache = new Map<string, string>();

  /**
   * HARDCODED EMAIL MAPPING: Portal Email → Slack Email
   * This is a temporary solution until we add a slackEmail field to the User entity.
   *
   * Maps portal login emails to their corresponding Slack account emails.
   */
  private readonly slackEmailMapping: Record<string, string> = {
    // Gerald Sadya: portal=geralds@silvertreebrands.com, slack=sadyageraldm@gmail.com
    'geralds@silvertreebrands.com': 'sadyageraldm@gmail.com',
    // John Smith (System Owner): portal=john.smith@silvertreebrands.com, slack=geralds@silvertreebrands.com
    'john.smith@silvertreebrands.com': 'geralds@silvertreebrands.com',
  };

  constructor(
    private configService: ConfigService,
    private systemOwnerService: SystemOwnerService,
  ) {
    const token = this.configService.get<string>('SLACK_BOT_TOKEN');
    if (!token) {
      this.logger.warn('SLACK_BOT_TOKEN not configured. Slack notifications will fail.');
    }
    this.client = new WebClient(token);
  }

  /**
   * Maps a portal email to its Slack email.
   * Falls back to the original email if no mapping exists.
   */
  private getSlackEmail(portalEmail: string): string {
    const mappedEmail = this.slackEmailMapping[portalEmail];
    if (mappedEmail) {
      this.logger.log(`[SlackNotificationAdapter] Mapped portal email ${portalEmail} → Slack email ${mappedEmail}`);
      return mappedEmail;
    }
    return portalEmail;
  }

  async notifyManager(context: NotificationContext): Promise<void> {
    const { request, link } = context;

    this.logger.log(`[SlackNotificationAdapter] notifyManager called for request ${request.id}`);
    this.logger.log(`[SlackNotificationAdapter] Target user: ${request.targetUser?.email}, Manager ID: ${request.targetUser?.managerId}, Manager loaded: ${!!request.targetUser?.manager}`);

    try {
      const manager = request.targetUser?.manager;
      if (!manager?.email) {
        this.logger.error(`[SlackNotificationAdapter] ❌ No manager email for user ${request.targetUserId} (targetUser: ${request.targetUser?.email}, managerId: ${request.targetUser?.managerId}, manager loaded: ${!!manager})`);
        return;
      }

      this.logger.log(`[SlackNotificationAdapter] Manager found: ${manager.email}, looking up Slack user...`);
      const slackUserId = await this.lookupSlackUser(manager.email);
      if (!slackUserId) {
        this.logger.error(`[SlackNotificationAdapter] ❌ Could not find Slack user for manager email: ${manager.email}`);
        return;
      }
      
      this.logger.log(`[SlackNotificationAdapter] ✓ Found Slack user ID: ${slackUserId} for email: ${manager.email}`);

      const firstItem = request.items?.[0];
      if (!firstItem) return;

      this.logger.log(`Sending Slack message to channel/user: ${slackUserId}`);
      const messageResult = await this.client.chat.postMessage({
        channel: slackUserId,
        text: 'Access request needs your approval',
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
              text: `*${request.requester?.name || 'Unknown'}* has requested access for *${request.targetUser?.name || 'Unknown'}*`,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*System:*\n${firstItem.systemInstance?.system?.name || 'Unknown'}`,
              },
              {
                type: 'mrkdwn',
                text: `*Instance:*\n${firstItem.systemInstance?.name || 'Unknown'}`,
              },
              {
                type: 'mrkdwn',
                text: `*Access Level:*\n${firstItem.accessTier?.name || 'Unknown'}`,
              },
              {
                type: 'mrkdwn',
                text: `*Justification:*\n${request.note || 'None provided'}`,
              },
            ],
          },
          ...(link
            ? [
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
                } as any,
              ]
            : []),
        ],
      });

      if (messageResult.ok) {
        this.logger.log(`[SlackNotificationAdapter] ✓✓✓ SUCCESS: Sent manager notification to ${manager.email} (Slack user: ${slackUserId}, ts: ${messageResult.ts})`);
        this.logger.log(`[SlackNotificationAdapter] Message preview: "${messageResult.message?.text || 'N/A'}"`);
      } else {
        this.logger.error(`[SlackNotificationAdapter] ❌ Slack API returned error: ${messageResult.error || 'Unknown error'}`);
        this.logger.error(`[SlackNotificationAdapter] Error details: ${JSON.stringify(messageResult, null, 2)}`);
      }
    } catch (error: any) {
      this.logger.error(`[SlackNotificationAdapter] ❌ EXCEPTION: Failed to notify manager: ${error.message}`);
      this.logger.error(`[SlackNotificationAdapter] Stack: ${error.stack}`);
      if (error.data) {
        this.logger.error(`[SlackNotificationAdapter] Error data: ${JSON.stringify(error.data, null, 2)}`);
      }
      // Re-throw to see in logs
      throw error;
    }
  }

  async notifySystemOwners(context: NotificationContext): Promise<void> {
    const { request, action, link } = context;

    try {
      const firstItem = request.items?.[0];
      if (!firstItem?.systemInstance?.systemId) return;

      const systemId = firstItem.systemInstance.systemId;
      const owners = await this.systemOwnerService.findBySystem(systemId);

      if (owners.length === 0) {
        this.logger.warn(`No system owners found for system ${systemId}`);
        return;
      }

      // Determine message content based on action
      let actionText: string;
      let headerEmoji: string;
      let headerText: string;

      switch (action) {
        case 'request':
          actionText = 'needs your review';
          headerEmoji = '📋';
          headerText = 'New Access Request';
          break;
        case 'approve':
          actionText = 'needs provisioning';
          headerEmoji = '✅';
          headerText = 'Provision Access';
          break;
        case 'to_remove':
        case 'remove':
          actionText = 'needs to be removed';
          headerEmoji = '🗑️';
          headerText = 'Remove Access';
          break;
        default:
          actionText = 'needs your attention';
          headerEmoji = '📋';
          headerText = 'Access Update';
      }

      const systemName = firstItem.systemInstance?.system?.name || 'Unknown System';

      for (const ownerRelation of owners) {
        const owner = ownerRelation.user;
        if (!owner?.email) continue;

        const slackUserId = await this.lookupSlackUser(owner.email);
        if (!slackUserId) continue;

        await this.client.chat.postMessage({
          channel: slackUserId,
          text: `Access ${actionText}`,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `${headerEmoji} ${headerText}`,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `Access for *${request.targetUser?.name || 'Unknown'}* to *${systemName}* ${actionText}`,
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Instance:*\n${firstItem.systemInstance?.name || 'Unknown'}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Access Level:*\n${firstItem.accessTier?.name || 'Unknown'}`,
                },
              ],
            },
            ...(link
              ? [
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
                  } as any,
                ]
              : []),
          ],
        });
      }

      this.logger.log(`Notified ${owners.length} system owners`);
    } catch (error: any) {
      this.logger.error(`Failed to notify system owners: ${error.message}`, error.stack);
    }
  }

  async notifyRequester(context: NotificationContext): Promise<void> {
    const { request, action, reason, link } = context;

    try {
      const requesterEmail = request.requester?.email;
      if (!requesterEmail) {
        this.logger.warn(`No requester email for request ${request.id} (requester: ${request.requesterId})`);
        return;
      }

      this.logger.log(`Looking up Slack user for requester email: ${requesterEmail}`);
      const slackUserId = await this.lookupSlackUser(requesterEmail);
      if (!slackUserId) {
        this.logger.warn(`Could not find Slack user for requester email: ${requesterEmail}`);
        return;
      }
      
      this.logger.log(`Found Slack user ID: ${slackUserId} for requester email: ${requesterEmail}`);

      let emoji = '📋';
      let title = 'Request Update';
      let message = '';

      switch (action) {
        case 'approve':
          emoji = '✅';
          title = 'Request Approved';
          message = `Your access request for *${request.targetUser?.name || 'Unknown'}* has been approved and is pending provisioning.`;
          break;
        case 'reject':
          emoji = '❌';
          title = 'Request Rejected';
          const rejectionReason = reason || request.note || 'No reason provided';
          message = `Your access request for *${request.targetUser?.name || 'Unknown'}* has been rejected.\n\n*Reason:* ${rejectionReason}`;
          break;
        case 'activate':
          emoji = '🎉';
          title = 'Access Granted';
          message = `Access has been provisioned for *${request.targetUser?.name || 'Unknown'}*.`;
          break;
        case 'remove':
          emoji = '🗑️';
          title = 'Access Removed';
          message = `Access has been removed for *${request.targetUser?.name || 'Unknown'}*.`;
          break;
      }

      const firstItem = request.items?.[0];
      const blocks: any[] = [
        {
          type: 'header',
          text: { type: 'plain_text', text: `${emoji} ${title}` },
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: message },
        },
      ];

      if (firstItem) {
        blocks.push({
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*System:*\n${firstItem.systemInstance?.system?.name || 'Unknown'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Instance:*\n${firstItem.systemInstance?.name || 'Unknown'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Access Level:*\n${firstItem.accessTier?.name || 'Unknown'}`,
            },
          ],
        });
      }

      if (link) {
        blocks.push({
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View Details' },
              url: link,
              style: 'primary',
            },
          ],
        } as any);
      }

      this.logger.log(`Sending ${action} notification to Slack user: ${slackUserId}`);
      const messageResult = await this.client.chat.postMessage({
        channel: slackUserId,
        text: title,
        blocks,
      });

      if (messageResult.ok) {
        this.logger.log(`[SlackNotificationAdapter] ✓✓✓ SUCCESS: Sent ${action} notification to ${requesterEmail} (Slack user: ${slackUserId}, ts: ${messageResult.ts})`);
        this.logger.log(`[SlackNotificationAdapter] Message preview: "${title}"`);
      } else {
        this.logger.error(`[SlackNotificationAdapter] ❌ Slack API returned error when sending ${action} message: ${messageResult.error || 'Unknown error'}`);
        this.logger.error(`[SlackNotificationAdapter] Error details: ${JSON.stringify(messageResult, null, 2)}`);
      }
    } catch (error: any) {
      this.logger.error(`[SlackNotificationAdapter] ❌ EXCEPTION: Failed to notify requester: ${error.message}`);
      this.logger.error(`[SlackNotificationAdapter] Stack: ${error.stack}`);
      if (error.data) {
        this.logger.error(`[SlackNotificationAdapter] Error data: ${JSON.stringify(error.data, null, 2)}`);
      }
      // Don't re-throw - notifications shouldn't break the flow
    }
  }

  private async lookupSlackUser(portalEmail: string): Promise<string | null> {
    // Map portal email to Slack email
    const slackEmail = this.getSlackEmail(portalEmail);

    if (this.userIdCache.has(slackEmail)) {
      const cached = this.userIdCache.get(slackEmail);
      this.logger.log(`Using cached Slack user ID for ${slackEmail}: ${cached}`);
      return cached || null;
    }

    try {
      this.logger.log(`Calling Slack API to lookup user by email: ${slackEmail}`);
      const result = await this.client.users.lookupByEmail({ email: slackEmail });

      if (!result.ok) {
        this.logger.error(`Slack API returned error for ${slackEmail}: ${result.error || 'Unknown error'}`);
        return null;
      }

      const userId = result.user?.id;

      if (userId) {
        this.userIdCache.set(slackEmail, userId);
        this.logger.log(`Successfully found Slack user ID ${userId} for email ${slackEmail}`);
        return userId;
      } else {
        this.logger.warn(`Slack API returned ok=true but no user ID for email: ${slackEmail}`);
      }
    } catch (error: any) {
      this.logger.error(`Exception looking up Slack user for ${slackEmail}: ${error.message}`, error.stack);
      if (error.data) {
        this.logger.error(`Slack API error data: ${JSON.stringify(error.data)}`);
      }
    }

    return null;
  }
}

