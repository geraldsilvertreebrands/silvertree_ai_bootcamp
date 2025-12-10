import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SlackNotificationAdapter } from '../../src/integrations/notifications/slack-notification.adapter';
import { NotificationContext } from '../../src/integrations/notifications/notification.interface';
import { AccessRequest, AccessRequestStatus } from '../../src/access-control/entities/access-request.entity';
import { AccessRequestItem, AccessRequestItemStatus } from '../../src/access-control/entities/access-request.entity';
import { SystemOwnerService } from '../../src/ownership/services/system-owner.service';
import { WebClient } from '@slack/web-api';

/**
 * REAL Slack Integration Test
 * This test actually calls Slack API (requires valid SLACK_BOT_TOKEN)
 * Run with: ENABLE_SLACK=true SLACK_BOT_TOKEN=xoxb-... npm test -- slack-notification-real.integration.spec.ts
 */
describe('SlackNotificationAdapter (REAL Slack API)', () => {
  let adapter: SlackNotificationAdapter;
  let configService: ConfigService;
  let mockSystemOwnerService: jest.Mocked<SystemOwnerService>;
  let realWebClient: WebClient;

  beforeAll(async () => {
    const slackToken = process.env.SLACK_BOT_TOKEN;
    if (!slackToken || !slackToken.startsWith('xoxb-')) {
      console.log('⚠️  SKIP: SLACK_BOT_TOKEN not set or invalid. Set ENABLE_SLACK=true and SLACK_BOT_TOKEN=xoxb-... to run real tests');
      return;
    }

    mockSystemOwnerService = {
      findBySystem: jest.fn(),
      findByUser: jest.fn(),
      assign: jest.fn(),
      remove: jest.fn(),
      isSystemOwner: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
        }),
      ],
      providers: [
        SlackNotificationAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'SLACK_BOT_TOKEN') {
                return process.env.SLACK_BOT_TOKEN;
              }
              if (key === 'APP_BASE_URL') {
                return process.env.APP_BASE_URL || 'http://localhost:3000';
              }
              return defaultValue;
            }),
          },
        },
        {
          provide: SystemOwnerService,
          useValue: mockSystemOwnerService,
        },
      ],
    }).compile();

    adapter = module.get<SlackNotificationAdapter>(SlackNotificationAdapter);
    configService = module.get<ConfigService>(ConfigService);
    realWebClient = (adapter as any).client;
  });

  describe('Real Slack API Tests', () => {
    it('should lookup Slack user by email', async () => {
      const testEmail = process.env.TEST_SLACK_EMAIL || 'geralds@silvertreebrands.com';
      
      const result = await realWebClient.users.lookupByEmail({ email: testEmail });
      
      expect(result.ok).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.id).toBeDefined();
      console.log(`✓ Found Slack user: ${result.user?.name} (${result.user?.id}) for email: ${testEmail}`);
    });

    it('should send a test notification to real Slack user', async () => {
      const testEmail = process.env.TEST_SLACK_EMAIL || 'geralds@silvertreebrands.com';
      
      // Lookup user
      const lookupResult = await realWebClient.users.lookupByEmail({ email: testEmail });
      if (!lookupResult.ok || !lookupResult.user?.id) {
        throw new Error(`Could not find Slack user for ${testEmail}`);
      }

      const slackUserId = lookupResult.user.id;
      
      // Send test message
      const messageResult = await realWebClient.chat.postMessage({
        channel: slackUserId,
        text: '🧪 Test notification from Access Management System',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🧪 Test Notification',
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'This is a *test notification* from the Access Management System.\n\nIf you received this, Slack integration is working! ✅',
            },
          },
        ],
      });

      expect(messageResult.ok).toBe(true);
      expect(messageResult.ts).toBeDefined();
      console.log(`✓ Sent test message to Slack user ${slackUserId}. Timestamp: ${messageResult.ts}`);
    });

    it('should send manager notification for real request', async () => {
      const testEmail = process.env.TEST_SLACK_EMAIL || 'geralds@silvertreebrands.com';
      
      const manager = {
        id: 'user-manager',
        email: testEmail,
        name: 'Test Manager',
      };
      
      const targetUser = {
        id: 'user-target',
        email: 'target@test.com',
        name: 'Target User',
        managerId: manager.id,
        manager,
      };
      
      const requester = {
        id: 'user-requester',
        email: 'requester@test.com',
        name: 'Test Requester',
      };
      
      const system = { id: 'sys-1', name: 'Magento' };
      const instance = {
        id: 'inst-1',
        name: 'UCOOK Production',
        systemId: system.id,
        system,
      };
      const tier = { id: 'tier-1', name: 'Admin', systemId: system.id };

      const request = {
        id: 'req-test',
        targetUserId: targetUser.id,
        targetUser,
        requesterId: requester.id,
        requester,
        status: AccessRequestStatus.REQUESTED,
        note: 'Test request for Slack integration',
        items: [
          {
            id: 'item-1',
            systemInstanceId: instance.id,
            systemInstance: instance,
            accessTierId: tier.id,
            accessTier: tier,
            status: AccessRequestItemStatus.REQUESTED,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as AccessRequest;

      const context: NotificationContext = {
        request,
        action: 'request',
        link: 'http://localhost:3000/dashboard.html#approvals',
      };

      // This should actually send to Slack
      await adapter.notifyManager(context);
      
      console.log(`✓ Manager notification sent. Check Slack for message to ${testEmail}`);
    });
  });
});

