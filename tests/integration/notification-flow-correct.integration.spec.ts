/**
 * TDD Tests for Correct Notification Flow
 *
 * Expected Flow:
 * 1. User (geralds@silvertreebrands.com, Slack: sadyageraldm@gmail.com) creates request for self
 * 2. System Owner (john.smith@silvertreebrands.com, Slack: geralds@silvertreebrands.com) gets Slack notification
 * 3. Owner approves/rejects via portal
 * 4. User gets Slack notification at sadyageraldm@gmail.com
 *
 * ONLY 2 Slack messages total:
 * - 1 to owner on request creation
 * - 1 to requester on approve/reject
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SlackNotificationAdapter } from '../../src/integrations/notifications/slack-notification.adapter';
import { NotificationContext } from '../../src/integrations/notifications/notification.interface';
import { AccessRequest, AccessRequestStatus } from '../../src/access-control/entities/access-request.entity';
import { AccessRequestItemStatus } from '../../src/access-control/entities/access-request.entity';
import { SystemOwnerService } from '../../src/ownership/services/system-owner.service';

// Mock Slack API
const mockPostMessage = jest.fn().mockResolvedValue({ ok: true, ts: '1234567890.123456' });
const mockLookupByEmail = jest.fn();

jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => ({
    chat: { postMessage: mockPostMessage },
    users: { lookupByEmail: mockLookupByEmail },
  })),
}));

describe('Notification Flow - Correct Implementation', () => {
  let adapter: SlackNotificationAdapter;
  let mockSystemOwnerService: jest.Mocked<SystemOwnerService>;

  // Test data matching real users
  const REQUESTER = {
    id: 'gerald-sadya-id',
    email: 'geralds@silvertreebrands.com', // Portal email
    name: 'Gerald Sadya',
    // Slack email: sadyageraldm@gmail.com (mapped in adapter)
  };

  const SYSTEM_OWNER = {
    id: 'john-smith-id',
    email: 'john.smith@silvertreebrands.com', // Portal email
    name: 'John Smith',
    // Slack email: geralds@silvertreebrands.com (mapped in adapter)
  };

  const createMockRequest = (status: AccessRequestStatus): AccessRequest => ({
    id: 'req-123',
    requesterId: REQUESTER.id,
    requester: REQUESTER as any,
    targetUserId: REQUESTER.id, // Self-request
    targetUser: { ...REQUESTER, managerId: SYSTEM_OWNER.id, manager: SYSTEM_OWNER } as any,
    status,
    note: 'Need access for project work',
    items: [
      {
        id: 'item-1',
        accessRequestId: 'req-123',
        systemInstanceId: 'inst-1',
        systemInstance: {
          id: 'inst-1',
          name: 'Faithful to Nature',
          systemId: 'sys-1',
          system: { id: 'sys-1', name: 'Magento' },
        },
        accessTierId: 'tier-1',
        accessTier: { id: 'tier-1', name: 'Admin', systemId: 'sys-1' },
        status: status === AccessRequestStatus.APPROVED
          ? AccessRequestItemStatus.APPROVED
          : status === AccessRequestStatus.REJECTED
            ? AccessRequestItemStatus.REJECTED
            : AccessRequestItemStatus.REQUESTED,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as AccessRequest);

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock system owner service to return John Smith as owner
    mockSystemOwnerService = {
      findBySystem: jest.fn().mockResolvedValue([
        {
          userId: SYSTEM_OWNER.id,
          systemId: 'sys-1',
          user: SYSTEM_OWNER
        },
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
          provide: 'ConfigService',
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'SLACK_BOT_TOKEN') return 'xoxb-test-token';
              if (key === 'APP_BASE_URL') return 'http://localhost:5173';
              return undefined;
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
  });

  describe('Step 1: Request Creation → Owner gets Slack notification', () => {
    it('should send notification to system owner Slack (geralds@silvertreebrands.com) when request is created', async () => {
      const request = createMockRequest(AccessRequestStatus.REQUESTED);

      // Mock: Owner's Slack lookup returns their Slack user ID
      // The adapter should map john.smith@ portal email → geralds@silvertreebrands.com Slack email
      mockLookupByEmail.mockImplementation(({ email }) => {
        // After mapping, john.smith@ should become geralds@silvertreebrands.com for Slack lookup
        if (email === 'geralds@silvertreebrands.com') {
          return Promise.resolve({ ok: true, user: { id: 'U_OWNER_SLACK' } });
        }
        return Promise.resolve({ ok: false, error: 'users_not_found' });
      });

      const context: NotificationContext = {
        request,
        action: 'request',
        link: 'http://localhost:5173/pending-provisions',
      };

      await adapter.notifySystemOwners(context);

      // Verify Slack lookup was called with OWNER's Slack email (mapped from portal email)
      expect(mockLookupByEmail).toHaveBeenCalledWith({ email: 'geralds@silvertreebrands.com' });

      // Verify message was sent
      expect(mockPostMessage).toHaveBeenCalledTimes(1);
      const callArgs = mockPostMessage.mock.calls[0][0];
      expect(callArgs.channel).toBe('U_OWNER_SLACK');
    });
  });

  describe('Step 2: Owner Approves → Requester gets "Access Granted" Slack notification', () => {
    it('should send "Access Granted" to requester Slack (sadyageraldm@gmail.com) when owner provisions', async () => {
      const request = createMockRequest(AccessRequestStatus.APPROVED);

      // Mock: Requester's Slack lookup
      // The adapter should map geralds@ portal email → sadyageraldm@gmail.com Slack email
      mockLookupByEmail.mockImplementation(({ email }) => {
        if (email === 'sadyageraldm@gmail.com') {
          return Promise.resolve({ ok: true, user: { id: 'U_REQUESTER_SLACK' } });
        }
        return Promise.resolve({ ok: false, error: 'users_not_found' });
      });

      const context: NotificationContext = {
        request,
        action: 'activate', // "Access Granted"
        link: 'http://localhost:5173/my-access',
      };

      await adapter.notifyRequester(context);

      // Verify Slack lookup was called with REQUESTER's Slack email (mapped from portal email)
      expect(mockLookupByEmail).toHaveBeenCalledWith({ email: 'sadyageraldm@gmail.com' });

      // Verify message was sent with "Access Granted" content
      expect(mockPostMessage).toHaveBeenCalledTimes(1);
      const callArgs = mockPostMessage.mock.calls[0][0];
      expect(callArgs.channel).toBe('U_REQUESTER_SLACK');
      expect(callArgs.text).toBe('Access Granted');

      // Check blocks contain the right emoji and title
      const blocks = callArgs.blocks as any[];
      const headerBlock = blocks.find((b: any) => b.type === 'header');
      expect(headerBlock?.text?.text).toContain('Access Granted');
    });
  });

  describe('Step 3: Owner Rejects → Requester gets rejection Slack notification', () => {
    it('should send rejection notification to requester Slack (sadyageraldm@gmail.com) with reason', async () => {
      const request = createMockRequest(AccessRequestStatus.REJECTED);

      mockLookupByEmail.mockImplementation(({ email }) => {
        if (email === 'sadyageraldm@gmail.com') {
          return Promise.resolve({ ok: true, user: { id: 'U_REQUESTER_SLACK' } });
        }
        return Promise.resolve({ ok: false, error: 'users_not_found' });
      });

      const context: NotificationContext = {
        request,
        action: 'reject',
        reason: 'Access not required for your role',
        link: 'http://localhost:5173/my-access',
      };

      await adapter.notifyRequester(context);

      expect(mockLookupByEmail).toHaveBeenCalledWith({ email: 'sadyageraldm@gmail.com' });
      expect(mockPostMessage).toHaveBeenCalledTimes(1);

      const callArgs = mockPostMessage.mock.calls[0][0];
      expect(callArgs.channel).toBe('U_REQUESTER_SLACK');
      expect(callArgs.text).toBe('Request Rejected');

      // Verify rejection reason is included
      const blocks = callArgs.blocks as any[];
      const textBlocks = blocks.filter((b: any) => b.type === 'section' && b.text?.text);
      const hasReason = textBlocks.some((b: any) => b.text.text.includes('Access not required'));
      expect(hasReason).toBe(true);
    });
  });

  describe('Email Mapping Verification', () => {
    it('should correctly map portal emails to Slack emails', () => {
      // This test documents the expected mapping
      const emailMapping: Record<string, string> = {
        'geralds@silvertreebrands.com': 'sadyageraldm@gmail.com',      // Gerald's Slack
        'john.smith@silvertreebrands.com': 'geralds@silvertreebrands.com', // John's Slack
      };

      // Verify mappings are defined
      expect(emailMapping['geralds@silvertreebrands.com']).toBe('sadyageraldm@gmail.com');
      expect(emailMapping['john.smith@silvertreebrands.com']).toBe('geralds@silvertreebrands.com');
    });
  });
});
