import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SlackNotificationAdapter } from '../../src/integrations/notifications/slack-notification.adapter';
import { NotificationContext } from '../../src/integrations/notifications/notification.interface';
import { AccessRequest, AccessRequestStatus } from '../../src/access-control/entities/access-request.entity';
import { AccessRequestItem, AccessRequestItemStatus } from '../../src/access-control/entities/access-request.entity';
import { SystemOwnerService } from '../../src/ownership/services/system-owner.service';
import { WebClient } from '@slack/web-api';

// Mock @slack/web-api
const mockPostMessage = jest.fn().mockResolvedValue({ ok: true });
const mockLookupByEmail = jest.fn();

jest.mock('@slack/web-api', () => {
  return {
    WebClient: jest.fn().mockImplementation(() => ({
      chat: { postMessage: mockPostMessage },
      users: { lookupByEmail: mockLookupByEmail },
    })),
  };
});

describe('Requester Notifications (Integration)', () => {
  let adapter: SlackNotificationAdapter;
  let configService: ConfigService;
  let mockSystemOwnerService: jest.Mocked<SystemOwnerService>;

  beforeEach(async () => {
    mockPostMessage.mockClear();
    mockLookupByEmail.mockClear();

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
          envFilePath: '.env.test',
        }),
      ],
      providers: [
        SlackNotificationAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'SLACK_BOT_TOKEN') {
                return 'xoxb-test-token';
              }
              if (key === 'APP_BASE_URL') {
                return 'http://localhost:3000';
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('notifyRequester - Approval', () => {
    it('should send approval notification to requester', async () => {
      const requester = { id: 'user-1', email: 'sadyageraldm@gmail.com', name: 'Test Requester' };
      const targetUser = { id: 'user-2', email: 'target@test.com', name: 'Target User' };
      const system = { id: 'sys-1', name: 'Magento' };
      const instance = {
        id: 'inst-1',
        name: 'UCOOK Production',
        systemId: system.id,
        system,
      };
      const tier = { id: 'tier-1', name: 'Admin', systemId: system.id };

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
            systemInstanceId: instance.id,
            systemInstance: instance,
            accessTierId: tier.id,
            accessTier: tier,
            status: AccessRequestItemStatus.APPROVED,
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
        action: 'approve',
        link: 'http://localhost:3000/dashboard.html#requests',
      };

      await adapter.notifyRequester(context);

      expect(mockLookupByEmail).toHaveBeenCalledWith({
        email: requester.email,
      });
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'U12345',
          text: 'Request Approved',
        }),
      );

      // Verify message contains approval content
      const callArgs = mockPostMessage.mock.calls[0][0];
      expect(callArgs.blocks).toBeDefined();
      const blocks = callArgs.blocks as any[];
      const headerBlock = blocks.find(b => b.type === 'header');
      expect(headerBlock?.text?.text).toContain('Request Approved');
    });
  });

  describe('notifyRequester - Rejection', () => {
    it('should send rejection notification with reason', async () => {
      const requester = { id: 'user-1', email: 'sadyageraldm@gmail.com', name: 'Test Requester' };
      const targetUser = { id: 'user-2', email: 'target@test.com', name: 'Target User' };
      const system = { id: 'sys-1', name: 'Magento' };
      const instance = {
        id: 'inst-1',
        name: 'UCOOK Production',
        systemId: system.id,
        system,
      };
      const tier = { id: 'tier-1', name: 'Admin', systemId: system.id };

      const request = {
        id: 'req-1',
        requesterId: requester.id,
        requester,
        targetUserId: targetUser.id,
        targetUser,
        status: AccessRequestStatus.REJECTED,
        note: 'Access not needed for this role',
        items: [
          {
            id: 'item-1',
            systemInstanceId: instance.id,
            systemInstance: instance,
            accessTierId: tier.id,
            accessTier: tier,
            status: AccessRequestItemStatus.REJECTED,
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
        action: 'reject',
        reason: 'Access not needed for this role',
        link: 'http://localhost:3000/dashboard.html#requests',
      };

      await adapter.notifyRequester(context);

      expect(mockLookupByEmail).toHaveBeenCalledWith({
        email: requester.email,
      });
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'U12345',
          text: 'Request Rejected',
        }),
      );

      // Verify message contains rejection reason
      const callArgs = mockPostMessage.mock.calls[0][0];
      expect(callArgs.blocks).toBeDefined();
      const blocks = callArgs.blocks as any[];
      const sectionBlock = blocks.find(b => b.type === 'section' && b.text?.text?.includes('rejected'));
      expect(sectionBlock?.text?.text).toContain('Access not needed for this role');
    });

    it('should handle rejection without reason gracefully', async () => {
      const requester = { id: 'user-1', email: 'sadyageraldm@gmail.com', name: 'Test Requester' };
      const request = {
        id: 'req-1',
        requesterId: requester.id,
        requester,
        targetUserId: 'user-2',
        targetUser: { id: 'user-2', email: 'target@test.com', name: 'Target User' },
        status: AccessRequestStatus.REJECTED,
        note: null,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as AccessRequest;

      mockLookupByEmail.mockResolvedValue({
        ok: true,
        user: { id: 'U12345' },
      });

      const context: NotificationContext = {
        request,
        action: 'reject',
        reason: undefined,
      };

      await adapter.notifyRequester(context);

      expect(mockPostMessage).toHaveBeenCalled();
      const callArgs = mockPostMessage.mock.calls[0][0];
      const blocks = callArgs.blocks as any[];
      const sectionBlock = blocks.find(b => b.type === 'section' && b.text?.text?.includes('rejected'));
      expect(sectionBlock?.text?.text).toContain('No reason provided');
    });
  });
});



