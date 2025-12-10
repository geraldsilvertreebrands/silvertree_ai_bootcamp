import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessRequestService } from '../../src/access-control/services/access-request.service';
import { AccessGrantService } from '../../src/access-control/services/access-grant.service';
import { AccessGrant, AccessGrantStatus } from '../../src/access-control/entities/access-grant.entity';
import {
  AccessRequest,
  AccessRequestItem,
  AccessRequestItemStatus,
  AccessRequestStatus,
} from '../../src/access-control/entities/access-request.entity';
import { AccessTier } from '../../src/systems/entities/access-tier.entity';
import { SystemInstance } from '../../src/systems/entities/system-instance.entity';
import { System } from '../../src/systems/entities/system.entity';
import { User } from '../../src/identity/entities/user.entity';
import { CreateAccessRequestDto } from '../../src/access-control/dto/create-access-request.dto';
import { CsvParserService } from '../../src/access-control/services/csv-parser.service';
import { NotFoundException } from '@nestjs/common';
import { AccessControlModule } from '../../src/access-control/access-control.module';
import { IdentityModule } from '../../src/identity/identity.module';
import { SystemsModule } from '../../src/systems/systems.module';
import { OwnershipModule } from '../../src/ownership/ownership.module';
import { AuthModule } from '../../src/auth/auth.module';
import { SystemOwner } from '../../src/ownership/entities/system-owner.entity';

describe('AccessRequestService (Integration)', () => {
  let module: TestingModule;
  let accessRequestService: AccessRequestService;
  let accessGrantService: AccessGrantService;
  let userRepo: Repository<User>;
  let systemRepo: Repository<System>;
  let instanceRepo: Repository<SystemInstance>;
  let tierRepo: Repository<AccessTier>;
  let grantRepo: Repository<AccessGrant>;
  let requestRepo: Repository<AccessRequest>;
  let requestItemRepo: Repository<AccessRequestItem>;

  let managerUser: User;
  let reportUser: User;
  let nonManagerUser: User;
  let system: System;
  let instance: SystemInstance;
  let tier: AccessTier;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_DATABASE || 'bootcamp_access',
          entities: [
            User,
            System,
            SystemInstance,
            AccessTier,
            AccessGrant,
            AccessRequest,
            AccessRequestItem,
            SystemOwner,
          ],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([
          User,
          System,
          SystemInstance,
          AccessTier,
          AccessGrant,
          AccessRequest,
          AccessRequestItem,
          SystemOwner,
        ]),
        IdentityModule,
        SystemsModule,
        OwnershipModule,
        AuthModule,
        AccessControlModule,
      ],
    }).compile();

    accessRequestService = module.get<AccessRequestService>(AccessRequestService);
    accessGrantService = module.get<AccessGrantService>(AccessGrantService);
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    systemRepo = module.get<Repository<System>>(getRepositoryToken(System));
    instanceRepo = module.get<Repository<SystemInstance>>(getRepositoryToken(SystemInstance));
    tierRepo = module.get<Repository<AccessTier>>(getRepositoryToken(AccessTier));
    grantRepo = module.get<Repository<AccessGrant>>(getRepositoryToken(AccessGrant));
    requestRepo = module.get<Repository<AccessRequest>>(getRepositoryToken(AccessRequest));
    requestItemRepo = module.get<Repository<AccessRequestItem>>(getRepositoryToken(AccessRequestItem));

    const timestamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    managerUser = await userRepo.save(
      userRepo.create({
        email: `manager-${timestamp}@test.com`,
        name: 'Manager User',
      }),
    );

    reportUser = await userRepo.save(
      userRepo.create({
        email: `report-${timestamp}@test.com`,
        name: 'Report User',
        managerId: managerUser.id,
      }),
    );

    nonManagerUser = await userRepo.save(
      userRepo.create({
        email: `nonmanager-${timestamp}@test.com`,
        name: 'Non Manager',
      }),
    );

    system = await systemRepo.save(
      systemRepo.create({
        name: `System ${timestamp}`,
        description: 'Test',
      }),
    );

    instance = await instanceRepo.save(
      instanceRepo.create({
        systemId: system.id,
        name: `Instance ${timestamp}`,
        region: 'ZA',
      }),
    );

    tier = await tierRepo.save(
      tierRepo.create({
        systemId: system.id,
        name: `admin-${timestamp}`,
        description: 'Admin tier',
      }),
    );
  });

  afterAll(async () => {
    try {
      await requestItemRepo.delete({ id: undefined as any });
    } catch (err) {
      // ignore
    }
    await module.close();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  beforeEach(async () => {
    await requestItemRepo.query('DELETE FROM access_request_items');
    await requestRepo.query('DELETE FROM access_requests');
    await grantRepo.query('DELETE FROM access_grants');
  });

  const makeDto = (): CreateAccessRequestDto => ({
    targetUserId: reportUser.id,
    items: [
      {
        systemInstanceId: instance.id,
        accessTierId: tier.id,
      },
    ],
  });

  it('manager requester auto-approves and creates grant', async () => {
    const dto = makeDto();
    const result = await accessRequestService.create(dto, managerUser.id);

    expect(result.status).toBe(AccessRequestStatus.APPROVED);
    expect(result.items[0].status).toBe(AccessRequestItemStatus.APPROVED);

    const grants = await grantRepo.find({
      where: {
        userId: reportUser.id,
        systemInstanceId: instance.id,
        accessTierId: tier.id,
        status: AccessGrantStatus.ACTIVE,
      },
    });
    expect(grants.length).toBe(1);
  });

  it('non-manager requester leaves request/items requested and does not create grants', async () => {
    const dto = makeDto();
    const result = await accessRequestService.create(dto, nonManagerUser.id);

    expect(result.status).toBe(AccessRequestStatus.REQUESTED);
    expect(result.items[0].status).toBe(AccessRequestItemStatus.REQUESTED);

    const grants = await grantRepo.find({
      where: {
        userId: reportUser.id,
        systemInstanceId: instance.id,
        accessTierId: tier.id,
      },
    });
    expect(grants.length).toBe(0);
  });

  it('manager auto-approve does not create duplicate active grants', async () => {
    await grantRepo.save(
      grantRepo.create({
        userId: reportUser.id,
        systemInstanceId: instance.id,
        accessTierId: tier.id,
        status: AccessGrantStatus.ACTIVE,
      }),
    );

    const dto = makeDto();
    const result = await accessRequestService.create(dto, managerUser.id);

    expect(result.status).toBe(AccessRequestStatus.APPROVED);
    expect(result.items[0].status).toBe(AccessRequestItemStatus.APPROVED);

    const grants = await grantRepo.find({
      where: {
        userId: reportUser.id,
        systemInstanceId: instance.id,
        accessTierId: tier.id,
        status: AccessGrantStatus.ACTIVE,
      },
    });
    expect(grants.length).toBe(1);
  });

  describe('System Owner Approval', () => {
    let systemOwner: User;
    let nonOwner: User;
    let requestUser: User;
    let ownerSystem: System;
    let ownerInstance: SystemInstance;
    let ownerTier: AccessTier;

    beforeEach(async () => {
      const timestamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      systemOwner = await userRepo.save(
        userRepo.create({
          email: `owner-${timestamp}@test.com`,
          name: 'System Owner',
        }),
      );
      nonOwner = await userRepo.save(
        userRepo.create({
          email: `nonowner-${timestamp}@test.com`,
          name: 'Non Owner',
        }),
      );
      requestUser = await userRepo.save(
        userRepo.create({
          email: `requester-${timestamp}@test.com`,
          name: 'Requester',
        }),
      );

      ownerSystem = await systemRepo.save(
        systemRepo.create({
          name: `Owner System ${timestamp}`,
          description: 'Test',
        }),
      );
      ownerInstance = await instanceRepo.save(
        instanceRepo.create({
          systemId: ownerSystem.id,
          name: `Owner Instance ${timestamp}`,
          region: 'US',
        }),
      );
      ownerTier = await tierRepo.save(
        tierRepo.create({
          systemId: ownerSystem.id,
          name: `owner-tier-${timestamp}`,
          description: 'Test',
        }),
      );

      const { SystemOwner } = await import('../../src/ownership/entities/system-owner.entity');
      const ownerRepo = module.get<Repository<SystemOwner>>(getRepositoryToken(SystemOwner));
      await ownerRepo.save(
        ownerRepo.create({
          userId: systemOwner.id,
          systemId: ownerSystem.id,
        }),
      );
    });

    it('system owner can approve individual items and create grants', async () => {
      const dto: CreateAccessRequestDto = {
        targetUserId: requestUser.id,
        items: [
          {
            systemInstanceId: ownerInstance.id,
            accessTierId: ownerTier.id,
          },
        ],
      };
      const request = await accessRequestService.create(dto, nonOwner.id);
      expect(request.status).toBe(AccessRequestStatus.REQUESTED);
      expect(request.items[0].status).toBe(AccessRequestItemStatus.REQUESTED);

      // System owners approve items individually (not the whole request)
      const approved = await accessRequestService.approveItem(request.items[0].id, systemOwner.id);
      expect(approved.status).toBe(AccessRequestItemStatus.APPROVED);

      // Reload request to check status
      const reloaded = await requestRepo.findOne({
        where: { id: request.id },
        relations: ['items'],
      });
      expect(reloaded?.status).toBe(AccessRequestStatus.APPROVED);

      const grants = await grantRepo.find({
        where: {
          userId: requestUser.id,
          systemInstanceId: ownerInstance.id,
          accessTierId: ownerTier.id,
          status: AccessGrantStatus.ACTIVE,
        },
      });
      expect(grants.length).toBe(1);
    });

    it('system owner can reject individual items without creating grants', async () => {
      const dto: CreateAccessRequestDto = {
        targetUserId: requestUser.id,
        items: [
          {
            systemInstanceId: ownerInstance.id,
            accessTierId: ownerTier.id,
          },
        ],
      };
      const request = await accessRequestService.create(dto, nonOwner.id);

      // System owners reject items individually
      const rejected = await accessRequestService.rejectItem(request.items[0].id, systemOwner.id, 'Not needed');
      expect(rejected.status).toBe(AccessRequestItemStatus.REJECTED);

      // Reload request to check status
      const reloaded = await requestRepo.findOne({
        where: { id: request.id },
        relations: ['items'],
      });
      expect(reloaded?.status).toBe(AccessRequestStatus.REJECTED);

      const grants = await grantRepo.find({
        where: {
          userId: requestUser.id,
          systemInstanceId: ownerInstance.id,
          accessTierId: ownerTier.id,
        },
      });
      expect(grants.length).toBe(0);
    });

    it('non-owner cannot approve an item', async () => {
      const dto: CreateAccessRequestDto = {
        targetUserId: requestUser.id,
        items: [
          {
            systemInstanceId: ownerInstance.id,
            accessTierId: ownerTier.id,
          },
        ],
      };
      const request = await accessRequestService.create(dto, nonOwner.id);

      await expect(
        accessRequestService.approveItem(request.items[0].id, nonOwner.id),
      ).rejects.toThrow('You are not authorized');
    });

    it('system owner can approve individual item', async () => {
      const dto: CreateAccessRequestDto = {
        targetUserId: requestUser.id,
        items: [
          {
            systemInstanceId: ownerInstance.id,
            accessTierId: ownerTier.id,
          },
        ],
      };
      const request = await accessRequestService.create(dto, nonOwner.id);

      const approved = await accessRequestService.approveItem(request.items[0].id, systemOwner.id);
      expect(approved.status).toBe(AccessRequestItemStatus.APPROVED);

      const grants = await grantRepo.find({
        where: {
          userId: requestUser.id,
          systemInstanceId: ownerInstance.id,
          accessTierId: ownerTier.id,
          status: AccessGrantStatus.ACTIVE,
        },
      });
      expect(grants.length).toBe(1);
    });
  });

  describe('Manager Approval Flow (PHASE2-003)', () => {
    let manager: User;
    let employee: User;
    let otherUser: User;
    let testSystem: System;
    let testInstance: SystemInstance;
    let testTier: AccessTier;

    beforeEach(async () => {
      const timestamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      manager = await userRepo.save(
        userRepo.create({
          email: `manager-${timestamp}@test.com`,
          name: 'Manager',
        }),
      );
      employee = await userRepo.save(
        userRepo.create({
          email: `employee-${timestamp}@test.com`,
          name: 'Employee',
          managerId: manager.id,
        }),
      );
      otherUser = await userRepo.save(
        userRepo.create({
          email: `other-${timestamp}@test.com`,
          name: 'Other User',
        }),
      );

      testSystem = await systemRepo.save(
        systemRepo.create({
          name: `Test System ${timestamp}`,
          description: 'Test',
        }),
      );
      testInstance = await instanceRepo.save(
        instanceRepo.create({
          systemId: testSystem.id,
          name: `Instance ${timestamp}`,
          region: 'US',
        }),
      );
      testTier = await tierRepo.save(
        tierRepo.create({
          systemId: testSystem.id,
          name: `tier-${timestamp}`,
          description: 'Test',
        }),
      );
    });

    it('manager can approve a requested access request', async () => {
      const dto: CreateAccessRequestDto = {
        targetUserId: employee.id,
        items: [
          {
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
        ],
      };
      const request = await accessRequestService.create(dto, otherUser.id);
      expect(request.status).toBe(AccessRequestStatus.REQUESTED);

      const approved = await accessRequestService.approveRequest(request.id, manager.id);
      expect(approved.status).toBe(AccessRequestStatus.APPROVED);
      expect(approved.items[0].status).toBe(AccessRequestItemStatus.APPROVED);

      // Manager approval does NOT create grants - that's done by system owners (PHASE2-004)
      const grants = await grantRepo.find({
        where: {
          userId: employee.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        },
      });
      expect(grants.length).toBe(0);
    });

    it('manager can reject a requested access request with reason', async () => {
      const dto: CreateAccessRequestDto = {
        targetUserId: employee.id,
        items: [
          {
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
        ],
      };
      const request = await accessRequestService.create(dto, otherUser.id);
      expect(request.status).toBe(AccessRequestStatus.REQUESTED);

      const reason = 'Access not needed for current role';
      const rejected = await accessRequestService.rejectRequest(request.id, manager.id, reason);
      expect(rejected.status).toBe(AccessRequestStatus.REJECTED);
      expect(rejected.items[0].status).toBe(AccessRequestItemStatus.REJECTED);
      expect(rejected.note).toBe(reason);

      // Rejected requests should not create grants
      const grants = await grantRepo.find({
        where: {
          userId: employee.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        },
      });
      expect(grants.length).toBe(0);
    });

    it('non-manager cannot approve a request', async () => {
      const dto: CreateAccessRequestDto = {
        targetUserId: employee.id,
        items: [
          {
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
        ],
      };
      const request = await accessRequestService.create(dto, otherUser.id);

      await expect(
        accessRequestService.approveRequest(request.id, otherUser.id),
      ).rejects.toThrow('Only the manager of the grantee can approve this request');
    });

    it('non-manager cannot reject a request', async () => {
      const dto: CreateAccessRequestDto = {
        targetUserId: employee.id,
        items: [
          {
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
        ],
      };
      const request = await accessRequestService.create(dto, otherUser.id);

      await expect(
        accessRequestService.rejectRequest(request.id, otherUser.id, 'Reason'),
      ).rejects.toThrow('Only the manager of the grantee can reject this request');
    });

    it('cannot approve a request that is not in REQUESTED status', async () => {
      const dto: CreateAccessRequestDto = {
        targetUserId: employee.id,
        items: [
          {
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
        ],
      };
      const request = await accessRequestService.create(dto, manager.id);
      // Manager request auto-approves
      expect(request.status).toBe(AccessRequestStatus.APPROVED);

      await expect(
        accessRequestService.approveRequest(request.id, manager.id),
      ).rejects.toThrow('Invalid status transition');
    });

    it('cannot reject a request that is not in REQUESTED status', async () => {
      const dto: CreateAccessRequestDto = {
        targetUserId: employee.id,
        items: [
          {
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
        ],
      };
      const request = await accessRequestService.create(dto, manager.id);
      // Manager request auto-approves
      expect(request.status).toBe(AccessRequestStatus.APPROVED);

      await expect(
        accessRequestService.rejectRequest(request.id, manager.id, 'Reason'),
      ).rejects.toThrow('Invalid status transition');
    });

    it('findPendingForManager returns only requests for manager\'s team members', async () => {
      // Create a request for employee (manager's direct report)
      const dto1: CreateAccessRequestDto = {
        targetUserId: employee.id,
        items: [
          {
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
        ],
      };
      const request1 = await accessRequestService.create(dto1, otherUser.id);
      expect(request1.status).toBe(AccessRequestStatus.REQUESTED);

      // Create a request for otherUser (not manager's direct report)
      const dto2: CreateAccessRequestDto = {
        targetUserId: otherUser.id,
        items: [
          {
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
        ],
      };
      const request2 = await accessRequestService.create(dto2, employee.id);
      expect(request2.status).toBe(AccessRequestStatus.REQUESTED);

      // Manager should only see request1 (for their direct report)
      const pending = await accessRequestService.findPendingForManager(manager.id);
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe(request1.id);
      expect(pending[0].targetUser.id).toBe(employee.id);
    });

    it('findPendingForManager excludes non-REQUESTED requests', async () => {
      const dto: CreateAccessRequestDto = {
        targetUserId: employee.id,
        items: [
          {
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
        ],
      };
      const request = await accessRequestService.create(dto, otherUser.id);
      
      // Approve the request
      await accessRequestService.approveRequest(request.id, manager.id);

      // Pending should be empty now
      const pending = await accessRequestService.findPendingForManager(manager.id);
      expect(pending.length).toBe(0);
    });
  });

  describe('System Owner Provisioning (PHASE2-004)', () => {
    let systemOwner: User;
    let employee: User;
    let requester: User;
    let testSystem: System;
    let testInstance: SystemInstance;
    let testTier: AccessTier;
    let manager: User;

    beforeEach(async () => {
      const timestamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      
      // Create manager
      manager = await userRepo.save(
        userRepo.create({
          email: `manager-${timestamp}@test.com`,
          name: 'Manager',
        }),
      );

      // Create employee with manager
      employee = await userRepo.save(
        userRepo.create({
          email: `employee-${timestamp}@test.com`,
          name: 'Employee',
          managerId: manager.id,
        }),
      );

      // Create system owner
      systemOwner = await userRepo.save(
        userRepo.create({
          email: `owner-${timestamp}@test.com`,
          name: 'System Owner',
        }),
      );

      // Create requester
      requester = await userRepo.save(
        userRepo.create({
          email: `requester-${timestamp}@test.com`,
          name: 'Requester',
        }),
      );

      // Create system
      testSystem = await systemRepo.save(
        systemRepo.create({
          name: `Test System ${timestamp}`,
          description: 'Test',
        }),
      );

      // Make systemOwner an owner of the system
      const { SystemOwner } = await import('../../src/ownership/entities/system-owner.entity');
      const ownerRepo = module.get<Repository<SystemOwner>>(getRepositoryToken(SystemOwner));
      await ownerRepo.save(
        ownerRepo.create({
          userId: systemOwner.id,
          systemId: testSystem.id,
        }),
      );

      // Create instance and tier
      testInstance = await instanceRepo.save(
        instanceRepo.create({
          systemId: testSystem.id,
          name: `Instance ${timestamp}`,
          region: 'US',
        }),
      );

      testTier = await tierRepo.save(
        tierRepo.create({
          systemId: testSystem.id,
          name: `tier-${timestamp}`,
          description: 'Test',
        }),
      );
    });

    it('system owner can provision an approved request item', async () => {
      // 1. Create request (non-manager requester)
      const dto: CreateAccessRequestDto = {
        targetUserId: employee.id,
        items: [
          {
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
        ],
      };
      const request = await accessRequestService.create(dto, requester.id);
      expect(request.status).toBe(AccessRequestStatus.REQUESTED);
      expect(request.items[0].status).toBe(AccessRequestItemStatus.REQUESTED);

      // 2. Manager approves request
      const approved = await accessRequestService.approveRequest(request.id, manager.id);
      expect(approved.status).toBe(AccessRequestStatus.APPROVED);
      expect(approved.items[0].status).toBe(AccessRequestItemStatus.APPROVED);

      // 3. System owner provisions the approved item (creates grant)
      const grant = await accessRequestService.provisionItem(approved.items[0].id, systemOwner.id);
      expect(grant.status).toBe(AccessGrantStatus.ACTIVE);
      expect(grant.userId).toBe(employee.id);
      expect(grant.systemInstanceId).toBe(testInstance.id);
      expect(grant.accessTierId).toBe(testTier.id);
      expect(grant.grantedById).toBe(systemOwner.id);
      expect(grant.grantedAt).toBeDefined();

      // 4. Verify item is linked to grant
      const updatedItem = await requestItemRepo.findOne({
        where: { id: approved.items[0].id },
      });
      expect(updatedItem?.accessGrantId).toBe(grant.id);
    });

    it('findPendingProvisioning returns only approved items for owned systems', async () => {
      // Create another system owner doesn't own
      const otherSystem = await systemRepo.save(
        systemRepo.create({
          name: `Other System ${Date.now()}`,
          description: 'Test',
        }),
      );
      const otherInstance = await instanceRepo.save(
        instanceRepo.create({
          systemId: otherSystem.id,
          name: `Other Instance ${Date.now()}`,
          region: 'US',
        }),
      );
      const otherTier = await tierRepo.save(
        tierRepo.create({
          systemId: otherSystem.id,
          name: `other-tier-${Date.now()}`,
          description: 'Test',
        }),
      );

      // Create request with items for both systems
      const dto: CreateAccessRequestDto = {
        targetUserId: employee.id,
        items: [
          {
            systemInstanceId: testInstance.id, // Owned system
            accessTierId: testTier.id,
          },
          {
            systemInstanceId: otherInstance.id, // Not owned system
            accessTierId: otherTier.id,
          },
        ],
      };
      const request = await accessRequestService.create(dto, requester.id);
      
      // Manager approves
      await accessRequestService.approveRequest(request.id, manager.id);

      // System owner should only see item for owned system
      const pending = await accessRequestService.findPendingProvisioning(systemOwner.id);
      expect(pending.length).toBe(1);
      expect(pending[0].systemInstance.systemId).toBe(testSystem.id);
    });

    it('findPendingProvisioning excludes non-approved items', async () => {
      const dto: CreateAccessRequestDto = {
        targetUserId: employee.id,
        items: [
          {
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
        ],
      };
      const request = await accessRequestService.create(dto, requester.id);
      // Don't approve - leave as REQUESTED

      const pending = await accessRequestService.findPendingProvisioning(systemOwner.id);
      expect(pending.length).toBe(0);
    });

    it('findPendingProvisioning excludes already provisioned items', async () => {
      const dto: CreateAccessRequestDto = {
        targetUserId: employee.id,
        items: [
          {
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
        ],
      };
      const request = await accessRequestService.create(dto, requester.id);
      
      // Manager approves
      const approved = await accessRequestService.approveRequest(request.id, manager.id);
      
      // System owner provisions
      await accessRequestService.provisionItem(approved.items[0].id, systemOwner.id);

      // Should not appear in pending anymore
      const pending = await accessRequestService.findPendingProvisioning(systemOwner.id);
      expect(pending.length).toBe(0);
    });

    it('non-owner cannot provision an item', async () => {
      const dto: CreateAccessRequestDto = {
        targetUserId: employee.id,
        items: [
          {
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
        ],
      };
      const request = await accessRequestService.create(dto, requester.id);
      const approved = await accessRequestService.approveRequest(request.id, manager.id);

      await expect(
        accessRequestService.provisionItem(approved.items[0].id, requester.id),
      ).rejects.toThrow('You are not authorized');
    });

    it('cannot provision a non-approved item', async () => {
      const dto: CreateAccessRequestDto = {
        targetUserId: employee.id,
        items: [
          {
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
        ],
      };
      const request = await accessRequestService.create(dto, requester.id);
      // Item is still REQUESTED, not approved

      await expect(
        accessRequestService.provisionItem(request.items[0].id, systemOwner.id),
      ).rejects.toThrow('Cannot provision item in status');
    });

    it('bulk provision processes multiple items', async () => {
      const dto: CreateAccessRequestDto = {
        targetUserId: employee.id,
        items: [
          {
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
        ],
      };
      const request = await accessRequestService.create(dto, requester.id);
      const approved = await accessRequestService.approveRequest(request.id, manager.id);

      const result = await accessRequestService.bulkProvision([approved.items[0].id], systemOwner.id);
      expect(result.successful.length).toBe(1);
      expect(result.failed.length).toBe(0);
      expect(result.successful[0].status).toBe(AccessGrantStatus.ACTIVE);
    });

    it('bulk provision handles failures gracefully', async () => {
      const dto: CreateAccessRequestDto = {
        targetUserId: employee.id,
        items: [
          {
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
        ],
      };
      const request = await accessRequestService.create(dto, requester.id);
      const approved = await accessRequestService.approveRequest(request.id, manager.id);

      // Try to provision with non-owner (will fail)
      const result = await accessRequestService.bulkProvision([approved.items[0].id], requester.id);
      expect(result.successful.length).toBe(0);
      expect(result.failed.length).toBe(1);
      expect(result.failed[0].reason).toContain('not authorized');
    });
  });

  describe('Copy Grants from User (PHASE2-007)', () => {
    let manager: User;
    let sourceUser: User;
    let targetUser: User;
    let nonManager: User;
    let testSystem: System;
    let testInstance: SystemInstance;
    let testTier: AccessTier;
    let testSystem2: System;
    let testInstance2: SystemInstance;
    let testTier2: AccessTier;

    beforeEach(async () => {
      const timestamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      
      manager = await userRepo.save(
        userRepo.create({
          email: `manager-${timestamp}@test.com`,
          name: 'Manager',
        }),
      );

      sourceUser = await userRepo.save(
        userRepo.create({
          email: `source-${timestamp}@test.com`,
          name: 'Source User',
        }),
      );

      targetUser = await userRepo.save(
        userRepo.create({
          email: `target-${timestamp}@test.com`,
          name: 'Target User',
          managerId: manager.id,
        }),
      );

      nonManager = await userRepo.save(
        userRepo.create({
          email: `nonmanager-${timestamp}@test.com`,
          name: 'Non Manager',
        }),
      );

      // Create test systems
      testSystem = await systemRepo.save(
        systemRepo.create({
          name: `Test System ${timestamp}`,
          description: 'Test',
        }),
      );

      testInstance = await instanceRepo.save(
        instanceRepo.create({
          systemId: testSystem.id,
          name: `Instance ${timestamp}`,
          region: 'US',
        }),
      );

      testTier = await tierRepo.save(
        tierRepo.create({
          systemId: testSystem.id,
          name: `tier-${timestamp}`,
          description: 'Test',
        }),
      );

      // Create second system for filtering tests
      testSystem2 = await systemRepo.save(
        systemRepo.create({
          name: `Test System 2 ${timestamp}`,
          description: 'Test',
        }),
      );

      testInstance2 = await instanceRepo.save(
        instanceRepo.create({
          systemId: testSystem2.id,
          name: `Instance 2 ${timestamp}`,
          region: 'US',
        }),
      );

      testTier2 = await tierRepo.save(
        tierRepo.create({
          systemId: testSystem2.id,
          name: `tier2-${timestamp}`,
          description: 'Test',
        }),
      );

      // Create active grants for source user
      await grantRepo.save(
        grantRepo.create({
          userId: sourceUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
          status: AccessGrantStatus.ACTIVE,
        }),
      );

      await grantRepo.save(
        grantRepo.create({
          userId: sourceUser.id,
          systemInstanceId: testInstance2.id,
          accessTierId: testTier2.id,
          status: AccessGrantStatus.ACTIVE,
        }),
      );
    });

    it('copies all active grants from source to target user', async () => {
      const result = await accessRequestService.copyGrantsFromUser(
        {
          sourceUserId: sourceUser.id,
          targetUserId: targetUser.id,
        },
        manager.id,
      );

      expect(result.summary.total).toBe(2);
      expect(result.summary.created).toBe(2);
      expect(result.summary.skipped).toBe(0);
      expect(result.created.length).toBe(2);
      
      // Both requests should be auto-approved (manager is requester)
      expect(result.summary.autoApproved).toBe(2);
      result.created.forEach((req) => {
        expect(req.status).toBe(AccessRequestStatus.APPROVED);
        expect(req.targetUserId).toBe(targetUser.id);
      });
    });

    it('skips grants where target already has access', async () => {
      // Create an active grant for target user
      await grantRepo.save(
        grantRepo.create({
          userId: targetUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
          status: AccessGrantStatus.ACTIVE,
        }),
      );

      const result = await accessRequestService.copyGrantsFromUser(
        {
          sourceUserId: sourceUser.id,
          targetUserId: targetUser.id,
        },
        manager.id,
      );

      expect(result.summary.total).toBe(2);
      expect(result.summary.created).toBe(1);
      expect(result.summary.skipped).toBe(1);
      expect(result.skipped[0].reason).toContain('already has this access');
    });

    it('filters by systemIds', async () => {
      const result = await accessRequestService.copyGrantsFromUser(
        {
          sourceUserId: sourceUser.id,
          targetUserId: targetUser.id,
          systemIds: [testSystem.id],
        },
        manager.id,
      );

      expect(result.summary.total).toBe(1);
      expect(result.summary.created).toBe(1);
      expect(result.created[0].items[0].systemInstanceId).toBe(testInstance.id);
    });

    it('filters by excludeSystemIds', async () => {
      const result = await accessRequestService.copyGrantsFromUser(
        {
          sourceUserId: sourceUser.id,
          targetUserId: targetUser.id,
          excludeSystemIds: [testSystem.id],
        },
        manager.id,
      );

      expect(result.summary.total).toBe(1);
      expect(result.summary.created).toBe(1);
      expect(result.created[0].items[0].systemInstanceId).toBe(testInstance2.id);
    });

    it('returns empty result if source has no active grants', async () => {
      // Clear existing grants
      await grantRepo.delete({ userId: sourceUser.id });

      const result = await accessRequestService.copyGrantsFromUser(
        {
          sourceUserId: sourceUser.id,
          targetUserId: targetUser.id,
        },
        manager.id,
      );

      expect(result.summary.total).toBe(0);
      expect(result.summary.created).toBe(0);
      expect(result.created.length).toBe(0);
    });

    it('throws NotFoundException if source user not found', async () => {
      await expect(
        accessRequestService.copyGrantsFromUser(
          {
            sourceUserId: '00000000-0000-0000-0000-000000000000',
            targetUserId: targetUser.id,
          },
          manager.id,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if target user not found', async () => {
      await expect(
        accessRequestService.copyGrantsFromUser(
          {
            sourceUserId: sourceUser.id,
            targetUserId: '00000000-0000-0000-0000-000000000000',
          },
          manager.id,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates in requested status when requester is not manager', async () => {
      const result = await accessRequestService.copyGrantsFromUser(
        {
          sourceUserId: sourceUser.id,
          targetUserId: targetUser.id,
        },
        nonManager.id, // Non-manager requester
      );

      expect(result.summary.created).toBeGreaterThan(0);
      // Requests should be in REQUESTED status (not auto-approved)
      result.created.forEach((req) => {
        expect(req.status).toBe(AccessRequestStatus.REQUESTED);
      });
      expect(result.summary.autoApproved).toBe(0);
    });

    it('skips grants where target has pending request', async () => {
      // Create a pending request for target user
      const pendingRequest = await accessRequestService.create(
        {
          targetUserId: targetUser.id,
          items: [
            {
              systemInstanceId: testInstance.id,
              accessTierId: testTier.id,
            },
          ],
        },
        nonManager.id,
      );

      expect(pendingRequest.status).toBe(AccessRequestStatus.REQUESTED);

      const result = await accessRequestService.copyGrantsFromUser(
        {
          sourceUserId: sourceUser.id,
          targetUserId: targetUser.id,
        },
        manager.id,
      );

      expect(result.summary.total).toBe(2);
      expect(result.summary.skipped).toBe(1);
      expect(result.skipped[0].reason).toContain('already has this access');
    });
  });
});

