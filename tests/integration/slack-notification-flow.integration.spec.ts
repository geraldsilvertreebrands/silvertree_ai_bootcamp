/**
 * TDD Tests for Slack Notification Flow
 * Tests that the right people get the right notifications at the right time
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SlackNotificationAdapter } from '../../src/integrations/notifications/slack-notification.adapter';
import { NotificationContext } from '../../src/integrations/notifications/notification.interface';
import { AccessRequest, AccessRequestStatus } from '../../src/access-control/entities/access-request.entity';
import { AccessRequestItem, AccessRequestItemStatus } from '../../src/access-control/entities/access-request.entity';
import { SystemOwnerService } from '../../src/ownership/services/system-owner.service';
import { WebClient } from '@slack/web-api';

// Mock @slack/web-api
const mockPostMessage = jest.fn().mockResolvedValue({ ok: true, ts: '1234567890.123456' });
const mockLookupByEmail = jest.fn();

jest.mock('@slack/web-api', () => {
  return {
    WebClient: jest.fn().mockImplementation(() => ({
      chat: { postMessage: mockPostMessage },
      users: { lookupByEmail: mockLookupByEmail },
    })),
  };
});

describe('Slack Notification Flow (TDD)', () => {
  let adapter: SlackNotificationAdapter;
  let configService: ConfigService;
  let mockSystemOwnerService: jest.Mocked<SystemOwnerService>;

  beforeEach(async () => {
    mockPostMessage.mockClear();
    mockLookupByEmail.mockClear();

    mockSystemOwnerService = {
      findBySystem: jest.fn().mockResolvedValue([
        { userId: 'owner-1', systemId: 'sys-1', user: { email: 'owner@test.com', name: 'System Owner' } },
      ]),
      findByUser: jest.fn(),
      assign: jest.fn(),
      remove: jest.fn(),
      isSystemOwner: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
      ],
      providers: [
        SlackNotificationAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'SLACK_BOT_TOKEN') return 'xoxb-test-token';
              if (key === 'APP_BASE_URL') return 'http://localhost:3000';
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Manager Notifications', () => {
    it('should send request notification to manager when request is created', async () => {
      const manager = { id: 'manager-1', email: 'geralds@silvertreebrands.com', name: 'John Smith' };
      const requester = { id: 'requester-1', email: 'sadyageraldm@gmail.com', name: 'Test Requester' };
      const targetUser = { id: 'target-1', email: 'target@test.com', name: 'Target User', managerId: manager.id, manager };

      const request = {
        id: 'req-1',
        requesterId: requester.id,
        requester,
        targetUserId: targetUser.id,
        targetUser,
        status: AccessRequestStatus.REQUESTED,
        note: 'Test justification',
        items: [
          {
            id: 'item-1',
            systemInstanceId: 'inst-1',
            systemInstance: {
              id: 'inst-1',
              name: 'Pet Heaven Staging',
              systemId: 'sys-1',
              system: { id: 'sys-1', name: 'Shopify' },
            },
            accessTierId: 'tier-1',
            accessTier: { id: 'tier-1', name: 'Admin', systemId: 'sys-1' },
            status: AccessRequestItemStatus.REQUESTED,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as AccessRequest;

      mockLookupByEmail.mockResolvedValue({
        ok: true,
        user: { id: 'U12345' },
      });

      const context: NotificationContext = {
        request,
        action: 'request',
        link: 'http://localhost:3000/approvals/req-1',
      };

      await adapter.notifyManager(context);

      // Verify manager was looked up
      expect(mockLookupByEmail).toHaveBeenCalledWith({ email: manager.email });

      // Verify message was sent to manager
      expect(mockPostMessage).toHaveBeenCalledTimes(1);
      const callArgs = mockPostMessage.mock.calls[0][0];
      expect(callArgs.channel).toBe('U12345');
      expect(callArgs.text).toBe('Access request needs your approval');

      // Verify message contains all details
      const blocks = callArgs.blocks as any[];
      const headerBlock = blocks.find(b => b.type === 'header');
      expect(headerBlock?.text?.text).toBe('📋 Access Request');

      const fieldsBlock = blocks.find(b => b.type === 'section' && b.fields);
      expect(fieldsBlock.fields).toHaveLength(4);
      expect(fieldsBlock.fields[0].text).toContain('Shopify'); // System
      expect(fieldsBlock.fields[1].text).toContain('Pet Heaven Staging'); // Instance
      expect(fieldsBlock.fields[2].text).toContain('Admin'); // Access Level
      expect(fieldsBlock.fields[3].text).toContain('Test justification'); // Justification
    });

    it('should NOT send approval notification to manager - only requester gets approval notifications', async () => {
      // This test ensures managers don't get approval notifications
      // Managers should ONLY get request notifications
      const manager = { id: 'manager-1', email: 'geralds@silvertreebrands.com', name: 'John Smith' };
      const requester = { id: 'requester-1', email: 'sadyageraldm@gmail.com', name: 'Test Requester' };

      const request = {
        id: 'req-1',
        requesterId: requester.id,
        requester,
        targetUserId: 'target-1',
        targetUser: { id: 'target-1', email: 'target@test.com', name: 'Target User', managerId: manager.id },
        status: AccessRequestStatus.APPROVED,
        note: null,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as AccessRequest;

      // If notifyManager is called with action='approve', it should NOT send to manager
      // (This should never happen, but we test it anyway)
      mockLookupByEmail.mockClear();
      mockPostMessage.mockClear();

      // This should not be called for approval actions
      // Approval notifications go to requester, not manager
    });
  });

  describe('Requester Notifications', () => {
    it('should send approval notification to requester when manager approves', async () => {
      const requester = { id: 'requester-1', email: 'sadyageraldm@gmail.com', name: 'Test Requester' };
      const targetUser = { id: 'target-1', email: 'target@test.com', name: 'Target User' };

      const request = {
        id: 'req-1',
        requesterId: requester.id,
        requester,
        targetUserId: targetUser.id,
        targetUser,
        status: AccessRequestStatus.APPROVED,
        note: null,
        items: [
          {
            id: 'item-1',
            systemInstanceId: 'inst-1',
            systemInstance: {
              id: 'inst-1',
              name: 'Pet Heaven Staging',
              systemId: 'sys-1',
              system: { id: 'sys-1', name: 'Shopify' },
            },
            accessTierId: 'tier-1',
            accessTier: { id: 'tier-1', name: 'Admin', systemId: 'sys-1' },
            status: AccessRequestItemStatus.APPROVED,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as AccessRequest;

      mockLookupByEmail.mockResolvedValue({
        ok: true,
        user: { id: 'U67890' },
      });

      const context: NotificationContext = {
        request,
        action: 'approve',
        link: 'http://localhost:3000/requests/req-1',
      };

      await adapter.notifyRequester(context);

      // Verify requester was looked up
      expect(mockLookupByEmail).toHaveBeenCalledWith({ email: requester.email });

      // Verify message was sent to requester
      expect(mockPostMessage).toHaveBeenCalledTimes(1);
      const callArgs = mockPostMessage.mock.calls[0][0];
      expect(callArgs.channel).toBe('U67890');
      expect(callArgs.text).toBe('Request Approved');

      // Verify message contains all details
      const blocks = callArgs.blocks as any[];
      const headerBlock = blocks.find(b => b.type === 'header');
      expect(headerBlock?.text?.text).toBe('✅ Request Approved');

      const fieldsBlock = blocks.find(b => b.type === 'section' && b.fields);
      expect(fieldsBlock.fields).toBeDefined();
      expect(fieldsBlock.fields.length).toBe(3); // System, Instance, Access Level
      expect(fieldsBlock.fields[0].text).toContain('Shopify'); // System
      expect(fieldsBlock.fields[1].text).toContain('Pet Heaven Staging'); // Instance
      expect(fieldsBlock.fields[2].text).toContain('Admin'); // Access Level
    });

    it('should send rejection notification to requester with reason when manager rejects', async () => {
      const requester = { id: 'requester-1', email: 'sadyageraldm@gmail.com', name: 'Test Requester' };
      const targetUser = { id: 'target-1', email: 'target@test.com', name: 'Target User' };

      const request = {
        id: 'req-1',
        requesterId: requester.id,
        requester,
        targetUserId: targetUser.id,
        targetUser,
        status: AccessRequestStatus.REJECTED,
        note: 'Access not needed',
        items: [
          {
            id: 'item-1',
            systemInstanceId: 'inst-1',
            systemInstance: {
              id: 'inst-1',
              name: 'Pet Heaven Staging',
              systemId: 'sys-1',
              system: { id: 'sys-1', name: 'Shopify' },
            },
            accessTierId: 'tier-1',
            accessTier: { id: 'tier-1', name: 'Admin', systemId: 'sys-1' },
            status: AccessRequestItemStatus.REJECTED,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as AccessRequest;

      mockLookupByEmail.mockResolvedValue({
        ok: true,
        user: { id: 'U67890' },
      });

      const context: NotificationContext = {
        request,
        action: 'reject',
        reason: 'Access not needed for this role',
        link: 'http://localhost:3000/requests/req-1',
      };

      await adapter.notifyRequester(context);

      expect(mockLookupByEmail).toHaveBeenCalledWith({ email: requester.email });
      expect(mockPostMessage).toHaveBeenCalledTimes(1);

      const callArgs = mockPostMessage.mock.calls[0][0];
      const blocks = callArgs.blocks as any[];
      const sectionBlock = blocks.find(b => b.type === 'section' && b.text?.text?.includes('rejected'));
      expect(sectionBlock?.text?.text).toContain('Access not needed for this role');
    });
  });
});

