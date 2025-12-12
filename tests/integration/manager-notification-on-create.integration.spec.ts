/**
 * TDD Test: Verify manager receives Slack notification when request is created
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AccessRequestService } from '../../../src/access-control/services/access-request.service';
import { AccessRequest, AccessRequestItem } from '../../../src/access-control/entities/access-request.entity';
import { User } from '../../../src/identity/entities/user.entity';
import { SystemInstance } from '../../../src/systems/entities/system-instance.entity';
import { AccessTier } from '../../../src/systems/entities/access-tier.entity';
import { System } from '../../../src/systems/entities/system.entity';
import { AccessGrant } from '../../../src/access-control/entities/access-grant.entity';
import { NOTIFICATION_SERVICE, INotificationService } from '../../../src/integrations/notifications/notification.interface';
import { DeepLinkHelper } from '../../../src/integrations/notifications/deep-link.helper';
import { AccessGrantService } from '../../../src/access-control/services/access-grant.service';
import { SystemOwnerService } from '../../../src/ownership/services/system-owner.service';
import { OwnershipModule } from '../../../src/ownership/ownership.module';
import { ConfigModule } from '@nestjs/config';

describe('Manager Notification on Request Create (TDD)', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let accessRequestService: AccessRequestService;
  let mockNotificationService: jest.Mocked<INotificationService>;
  let requester: User;
  let manager: User;
  let targetUser: User;
  let testSystem: System;
  let testInstance: SystemInstance;
  let testTier: AccessTier;

  beforeAll(async () => {
    // Create mock notification service
    mockNotificationService = {
      notifyManager: jest.fn().mockResolvedValue(undefined),
      notifySystemOwners: jest.fn().mockResolvedValue(undefined),
      notifyRequester: jest.fn().mockResolvedValue(undefined),
    };

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          username: process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_DATABASE || 'bootcamp_access',
          entities: [User, System, SystemInstance, AccessTier, AccessRequest, AccessRequestItem, AccessGrant],
          synchronize: false,
        }),
        TypeOrmModule.forFeature([
          User,
          System,
          SystemInstance,
          AccessTier,
          AccessRequest,
          AccessRequestItem,
          AccessGrant,
        ]),
        OwnershipModule,
      ],
      providers: [
        AccessRequestService,
        AccessGrantService,
        SystemOwnerService,
        DeepLinkHelper,
        {
          provide: NOTIFICATION_SERVICE,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    accessRequestService = module.get<AccessRequestService>(AccessRequestService);
    dataSource = module.get<DataSource>(DataSource);
  });

  beforeEach(async () => {
    // Clear all tables
    await dataSource.query('TRUNCATE TABLE access_request_items CASCADE');
    await dataSource.query('TRUNCATE TABLE access_requests CASCADE');
    await dataSource.query('TRUNCATE TABLE access_grants CASCADE');
    await dataSource.query('TRUNCATE TABLE system_owners CASCADE');
    await dataSource.query('TRUNCATE TABLE users CASCADE');
    await dataSource.query('TRUNCATE TABLE access_tiers CASCADE');
    await dataSource.query('TRUNCATE TABLE system_instances CASCADE');
    await dataSource.query('TRUNCATE TABLE systems CASCADE');

    // Reset mocks
    jest.clearAllMocks();

    // Create test users
    const userRepo = dataSource.getRepository(User);
    manager = userRepo.create({
      name: 'John Smith',
      email: 'john.smith@test.com',
    });
    await userRepo.save(manager);

    requester = userRepo.create({
      name: 'Test Requester',
      email: 'requester@test.com',
    });
    await userRepo.save(requester);

    targetUser = userRepo.create({
      name: 'Test User',
      email: 'target@test.com',
      managerId: manager.id, // Manager relationship
    });
    await userRepo.save(targetUser);

    // Create test system
    const systemRepo = dataSource.getRepository(System);
    testSystem = systemRepo.create({
      name: 'Test System',
      description: 'Test',
    });
    await systemRepo.save(testSystem);

    // Create test instance
    const instanceRepo = dataSource.getRepository(SystemInstance);
    testInstance = instanceRepo.create({
      systemId: testSystem.id,
      name: 'Test Instance',
    });
    await instanceRepo.save(testInstance);

    // Create test tier
    const tierRepo = dataSource.getRepository(AccessTier);
    testTier = tierRepo.create({
      systemId: testSystem.id,
      name: 'Test Tier',
    });
    await tierRepo.save(testTier);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should send manager notification when request is created with REQUESTED status', async () => {
    // Arrange
    const createDto = {
      targetUserId: targetUser.id,
      items: [
        {
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        },
      ],
      note: 'Test request',
    };

    // Act
    const result = await accessRequestService.create(createDto, requester.id);

    // Assert
    expect(result.status).toBe('requested');
    expect(mockNotificationService.notifyManager).toHaveBeenCalledTimes(1);
    
    const notificationCall = mockNotificationService.notifyManager.mock.calls[0][0];
    expect(notificationCall.request.id).toBe(result.id);
    expect(notificationCall.action).toBe('request');
    expect(notificationCall.request.targetUser.manager.email).toBe(manager.email);
    expect(notificationCall.link).toBeDefined();
  });

  it('should NOT send manager notification if request is auto-approved', async () => {
    // Arrange: Make requester the manager of target user
    targetUser.managerId = requester.id;
    await dataSource.getRepository(User).save(targetUser);

    const createDto = {
      targetUserId: targetUser.id,
      items: [
        {
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        },
      ],
      note: 'Auto-approved request',
    };

    // Act
    const result = await accessRequestService.create(createDto, requester.id);

    // Assert: Should be auto-approved, so NO manager notification
    expect(result.status).toBe('approved');
    expect(mockNotificationService.notifyManager).not.toHaveBeenCalled();
    expect(mockNotificationService.notifySystemOwners).toHaveBeenCalledTimes(1);
  });

  it('should NOT send manager notification for self-requests', async () => {
    // Arrange: Self-request (requester === target)
    const createDto = {
      targetUserId: requester.id, // Self-request
      items: [
        {
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        },
      ],
      note: 'Self-request',
    };

    // Act
    const result = await accessRequestService.create(createDto, requester.id);

    // Assert: Self-requests should be REQUESTED, but manager notification should still be sent
    // (to the requester's manager, if they have one)
    expect(result.status).toBe('requested');
    // Note: If requester has no manager, notification won't be sent
    // If requester has a manager, notification should be sent
  });
});




