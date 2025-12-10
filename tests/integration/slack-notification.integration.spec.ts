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

describe('SlackNotificationAdapter (Integration)', () => {
  let adapter: SlackNotificationAdapter;
  let configService: ConfigService;
  let mockSystemOwnerService: jest.Mocked<SystemOwnerService>;

  beforeEach(async () => {
    // Reset mocks
    mockPostMessage.mockClear();
    mockLookupByEmail.mockClear();

    // Mock SystemOwnerService
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

  describe('notifyManager', () => {
    it('should send notification to manager when user has manager', async () => {
      const manager = { id: 'user-1', email: 'manager@test.com', name: 'Manager User' };
      const targetUser = {
        id: 'user-2',
        email: 'target@test.com',
        name: 'Target User',
        managerId: manager.id,
        manager,
      };
      const requester = { id: 'user-3', email: 'requester@test.com', name: 'Requester' };
      const system = { id: 'sys-1', name: 'Test System' };
      const instance = {
        id: 'inst-1',
        name: 'Test Instance',
        systemId: system.id,
        system,
      };
      const tier = { id: 'tier-1', name: 'Admin', systemId: system.id };

      const request = {
        id: 'req-1',
        targetUserId: targetUser.id,
        targetUser,
        requesterId: requester.id,
        requester,
        status: AccessRequestStatus.REQUESTED,
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
        note: 'Test justification',
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
        link: 'http://localhost:3000/approvals',
      };

      await adapter.notifyManager(context);

      expect(mockLookupByEmail).toHaveBeenCalledWith({
        email: manager.email,
      });
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'U12345',
          text: expect.stringContaining('Access request needs your approval'),
        }),
      );
    });

    it('should gracefully handle missing manager', async () => {
      const targetUser = {
        id: 'user-2',
        email: 'target@test.com',
        name: 'Target User',
        managerId: null,
      };
      const request = {
        id: 'req-1',
        targetUserId: targetUser.id,
        targetUser,
        requesterId: 'user-3',
        requester: { id: 'user-3', email: 'requester@test.com', name: 'Requester' },
        status: AccessRequestStatus.REQUESTED,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as AccessRequest;

      const context: NotificationContext = {
        request,
        action: 'request',
      };

      await adapter.notifyManager(context);

      expect(mockLookupByEmail).not.toHaveBeenCalled();
      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it('should gracefully handle Slack user not found', async () => {
      const manager = { id: 'user-1', email: 'manager@test.com', name: 'Manager User' };
      const targetUser = {
        id: 'user-2',
        email: 'target@test.com',
        name: 'Target User',
        managerId: manager.id,
        manager,
      };
      const request = {
        id: 'req-1',
        targetUserId: targetUser.id,
        targetUser,
        requesterId: 'user-3',
        requester: { id: 'user-3', email: 'requester@test.com', name: 'Requester' },
        status: AccessRequestStatus.REQUESTED,
        note: null,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as AccessRequest;

      mockLookupByEmail.mockResolvedValue({
        ok: false,
        error: 'users_not_found',
      });

      const context: NotificationContext = {
        request,
        action: 'request',
      };

      await adapter.notifyManager(context);

      expect(mockLookupByEmail).toHaveBeenCalled();
      expect(mockPostMessage).not.toHaveBeenCalled();
    });
  });

  describe('notifySystemOwners', () => {
    it('should notify all system owners', async () => {
      const owner1User = { id: 'user-owner1', email: 'owner1@test.com', name: 'Owner 1' };
      const owner2User = { id: 'user-owner2', email: 'owner2@test.com', name: 'Owner 2' };
      const system = { id: 'sys-1', name: 'Test System' };
      const instance = {
        id: 'inst-1',
        name: 'Test Instance',
        systemId: system.id,
        system,
      };
      const tier = { id: 'tier-1', name: 'Admin', systemId: system.id };

      const owner1 = {
        id: 'owner-1',
        userId: owner1User.id,
        systemId: system.id,
        user: owner1User,
      };
      const owner2 = {
        id: 'owner-2',
        userId: owner2User.id,
        systemId: system.id,
        user: owner2User,
      };

      const request = {
        id: 'req-1',
        targetUserId: 'user-1',
        targetUser: { id: 'user-1', email: 'target@test.com', name: 'Target User' },
        requesterId: 'user-2',
        requester: { id: 'user-2', email: 'requester@test.com', name: 'Requester' },
        status: AccessRequestStatus.APPROVED,
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

      mockSystemOwnerService.findBySystem.mockResolvedValue([owner1, owner2] as any);
      mockLookupByEmail
        .mockResolvedValueOnce({ ok: true, user: { id: 'U11111' } })
        .mockResolvedValueOnce({ ok: true, user: { id: 'U22222' } });

      const context: NotificationContext = {
        request,
        action: 'approve',
        link: 'http://localhost:3000/provisioning',
      };

      await adapter.notifySystemOwners(context);

      expect(mockSystemOwnerService.findBySystem).toHaveBeenCalledWith(system.id);
      expect(mockLookupByEmail).toHaveBeenCalledTimes(2);
      expect(mockPostMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('notifyRequester', () => {
    it('should send approval notification to requester', async () => {
      const requester = { id: 'user-1', email: 'requester@test.com', name: 'Requester' };
      const targetUser = { id: 'user-2', email: 'target@test.com', name: 'Target User' };
      const system = { id: 'sys-1', name: 'Test System' };
      const instance = {
        id: 'inst-1',
        name: 'Test Instance',
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
        link: 'http://localhost:3000/requests',
      };

      await adapter.notifyRequester(context);

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'U12345',
          text: expect.stringContaining('Request Approved'),
        }),
      );
    });

    it('should send rejection notification with reason', async () => {
      const requester = { id: 'user-1', email: 'requester@test.com', name: 'Requester' };
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
        reason: 'Access not needed',
      };

      await adapter.notifyRequester(context);

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'U12345',
          text: expect.stringContaining('Request Rejected'),
        }),
      );
    });
  });

  describe('user lookup caching', () => {
    it('should cache Slack user IDs', async () => {
      const manager = { id: 'user-1', email: 'manager@test.com', name: 'Manager' };
      const targetUser = {
        id: 'user-2',
        email: 'target@test.com',
        name: 'Target',
        managerId: manager.id,
        manager,
      };
      const system = { id: 'sys-1', name: 'Test System' };
      const instance = {
        id: 'inst-1',
        name: 'Test Instance',
        systemId: system.id,
        system,
      };
      const tier = { id: 'tier-1', name: 'Admin', systemId: system.id };
      
      const request = {
        id: 'req-1',
        targetUserId: targetUser.id,
        targetUser,
        requesterId: 'user-3',
        requester: { id: 'user-3', email: 'requester@test.com', name: 'Requester' },
        status: AccessRequestStatus.REQUESTED,
        note: 'Test',
        items: [{
          id: 'item-1',
          systemInstanceId: instance.id,
          systemInstance: instance,
          accessTierId: tier.id,
          accessTier: tier,
          status: AccessRequestItemStatus.REQUESTED,
        }],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as AccessRequest;

      mockLookupByEmail.mockClear();
      mockPostMessage.mockClear();
      mockLookupByEmail.mockResolvedValue({
        ok: true,
        user: { id: 'U12345' },
      });

      const context: NotificationContext = {
        request,
        action: 'request',
      };

      // Call twice
      await adapter.notifyManager(context);
      await adapter.notifyManager(context);

      // Should only lookup once due to caching
      expect(mockLookupByEmail).toHaveBeenCalledTimes(1);
      expect(mockPostMessage).toHaveBeenCalledTimes(2);
    });
  });
});
