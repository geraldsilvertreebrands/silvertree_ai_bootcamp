import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../src/identity/entities/user.entity';
import { System } from '../../src/systems/entities/system.entity';
import { SystemInstance } from '../../src/systems/entities/system-instance.entity';
import { AccessTier } from '../../src/systems/entities/access-tier.entity';
import {
  AccessGrant,
  AccessGrantStatus,
} from '../../src/access-control/entities/access-grant.entity';
import { SystemOwner } from '../../src/ownership/entities/system-owner.entity';
import { SystemOwnerService } from '../../src/ownership/services/system-owner.service';
import { OwnershipModule } from '../../src/ownership/ownership.module';
import { CsvParserService } from '../../src/access-control/services/csv-parser.service';
import { AuthModule } from '../../src/auth/auth.module';
import { AccessGrantService } from '../../src/access-control/services/access-grant.service';
import { AccessGrantsController } from '../../src/access-control/controllers/access-grants.controller';

describe('Access Grant Status Management (Integration)', () => {
  let accessGrantService: AccessGrantService;
  let controller: AccessGrantsController;
  let userRepository: Repository<User>;
  let systemRepository: Repository<System>;
  let systemInstanceRepository: Repository<SystemInstance>;
  let accessTierRepository: Repository<AccessTier>;
  let accessGrantRepository: Repository<AccessGrant>;
  let module: TestingModule;

  let testUser: User;
  let testSystem: System;
  let testInstance: SystemInstance;
  let testTier: AccessTier;

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
          entities: [User, System, SystemInstance, AccessTier, AccessGrant, SystemOwner],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([User, System, SystemInstance, AccessTier, AccessGrant, SystemOwner]),
        OwnershipModule,
        AuthModule,
      ],
      controllers: [AccessGrantsController],
      providers: [AccessGrantService, CsvParserService, SystemOwnerService],
    }).compile();

    accessGrantService = module.get<AccessGrantService>(AccessGrantService);
    controller = module.get<AccessGrantsController>(AccessGrantsController);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    systemRepository = module.get<Repository<System>>(getRepositoryToken(System));
    systemInstanceRepository = module.get<Repository<SystemInstance>>(
      getRepositoryToken(SystemInstance),
    );
    accessTierRepository = module.get<Repository<AccessTier>>(getRepositoryToken(AccessTier));
    accessGrantRepository = module.get<Repository<AccessGrant>>(getRepositoryToken(AccessGrant));

    // Create test data
    const timestamp = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    testUser = await userRepository.save({
      email: `user-${timestamp}@example.com`,
      name: 'Test User',
    });

    testSystem = await systemRepository.save({
      name: `Test System ${timestamp}`,
      description: 'Test',
    });

    testInstance = await systemInstanceRepository.save({
      systemId: testSystem.id,
      name: `Instance ${timestamp}`,
      region: 'US',
    });

    testTier = await accessTierRepository.save({
      systemId: testSystem.id,
      name: `admin-${timestamp}`,
      description: 'Admin access',
    });
  });

  afterAll(async () => {
    try {
      await accessGrantRepository.clear();
      await accessTierRepository.clear();
      await systemInstanceRepository.clear();
      await systemRepository.clear();
      await userRepository.clear();
    } catch (error) {
      // Ignore cleanup errors
    }
    await module.close();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  beforeEach(async () => {
    // Clean up grants before each test
    await accessGrantRepository.clear();

    // Verify test data exists
    const userExists = await userRepository.findOne({ where: { id: testUser.id } });
    const instanceExists = await systemInstanceRepository.findOne({
      where: { id: testInstance.id },
    });
    const tierExists = await accessTierRepository.findOne({ where: { id: testTier.id } });

    if (!userExists || !instanceExists || !tierExists) {
      const timestamp = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      testUser = await userRepository.save({
        email: `user-${timestamp}@example.com`,
        name: 'Test User',
      });
      testSystem = await systemRepository.save({
        name: `Test System ${timestamp}`,
        description: 'Test',
      });
      testInstance = await systemInstanceRepository.save({
        systemId: testSystem.id,
        name: `Instance ${timestamp}`,
        region: 'US',
      });
      testTier = await accessTierRepository.save({
        systemId: testSystem.id,
        name: `admin-${timestamp}`,
        description: 'Admin access',
      });
    }
  });

  describe('AccessGrantService', () => {
    describe('updateStatus', () => {
      it('should update status from active to removed', async () => {
        // Create active grant
        const grant = await accessGrantService.create({
          userId: testUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        });

        expect(grant.status).toBe(AccessGrantStatus.ACTIVE);
        expect(grant.removedAt).toBeNull();

        // Update to removed
        const updated = await accessGrantService.updateStatus(grant.id, {
          status: AccessGrantStatus.REMOVED,
        });

        expect(updated.status).toBe(AccessGrantStatus.REMOVED);
        expect(updated.removedAt).toBeDefined();
        expect(updated.removedAt).not.toBeNull();
      });

      it('should update status to TO_REMOVE and keep removedAt null', async () => {
        const grant = await accessGrantService.create({
          userId: testUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        });

        const updated = await accessGrantService.updateStatus(grant.id, {
          status: AccessGrantStatus.TO_REMOVE,
        });

        expect(updated.status).toBe(AccessGrantStatus.TO_REMOVE);
        expect(updated.removedAt).toBeNull();
      });

      it('should update status from removed to active', async () => {
        // Create removed grant
        const grant = await accessGrantService.create({
          userId: testUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
          status: AccessGrantStatus.REMOVED,
        });

        expect(grant.status).toBe(AccessGrantStatus.REMOVED);
        expect(grant.removedAt).not.toBeNull();

        // Reactivate
        const updated = await accessGrantService.updateStatus(grant.id, {
          status: AccessGrantStatus.ACTIVE,
        });

        expect(updated.status).toBe(AccessGrantStatus.ACTIVE);
        expect(updated.removedAt).toBeNull();
      });

      it('should set removedAt when marking as removed', async () => {
        const grant = await accessGrantService.create({
          userId: testUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        });

        const before = new Date();
        const updated = await accessGrantService.updateStatus(grant.id, {
          status: AccessGrantStatus.REMOVED,
        });
        const after = new Date();

        expect(updated.removedAt).toBeDefined();
        if (updated.removedAt) {
          expect(new Date(updated.removedAt).getTime()).toBeGreaterThanOrEqual(before.getTime());
          expect(new Date(updated.removedAt).getTime()).toBeLessThanOrEqual(after.getTime());
        }
      });

      it('should clear removedAt when reactivating', async () => {
        const grant = await accessGrantService.create({
          userId: testUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
          status: AccessGrantStatus.REMOVED,
        });

        expect(grant.removedAt).not.toBeNull();

        const updated = await accessGrantService.updateStatus(grant.id, {
          status: AccessGrantStatus.ACTIVE,
        });

        expect(updated.removedAt).toBeNull();
      });

      it('should throw NotFoundException when grant does not exist', async () => {
        const fakeGrantId = '00000000-0000-0000-0000-000000000000';

        await expect(
          accessGrantService.updateStatus(fakeGrantId, {
            status: AccessGrantStatus.REMOVED,
          }),
        ).rejects.toThrow('AccessGrant with ID 00000000-0000-0000-0000-000000000000 not found');
      });

      it('should load all relations in response', async () => {
        const grant = await accessGrantService.create({
          userId: testUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        });

        const updated = await accessGrantService.updateStatus(grant.id, {
          status: AccessGrantStatus.REMOVED,
        });

        expect(updated.user).toBeDefined();
        expect(updated.systemInstance).toBeDefined();
        expect(updated.systemInstance.system).toBeDefined();
        expect(updated.accessTier).toBeDefined();
      });
    });
  });

  describe('AccessGrantsController', () => {
    it('should update status through PATCH endpoint', async () => {
      // Create grant
      const grant = await controller.create({
        userId: testUser.id,
        systemInstanceId: testInstance.id,
        accessTierId: testTier.id,
      });

      // Update status
      const updated = await controller.updateStatus(grant.id, {
        status: AccessGrantStatus.REMOVED,
      });

      expect(updated.status).toBe(AccessGrantStatus.REMOVED);
      expect(updated.removedAt).not.toBeNull();
    });

    it('should allow setting status to TO_REMOVE without setting removedAt', async () => {
      const grant = await controller.create({
        userId: testUser.id,
        systemInstanceId: testInstance.id,
        accessTierId: testTier.id,
      });

      const updated = await controller.updateStatus(grant.id, {
        status: AccessGrantStatus.TO_REMOVE,
      });

      expect(updated.status).toBe(AccessGrantStatus.TO_REMOVE);
      expect(updated.removedAt).toBeNull();
    });
  });

  describe('PHASE2-005: Mark for Removal Flow', () => {
    let systemOwner: User;
    let nonOwner: User;
    let ownerRepo: Repository<SystemOwner>;

    beforeEach(async () => {
      const timestamp = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      // Create system owner
      systemOwner = await userRepository.save({
        email: `owner-${timestamp}@example.com`,
        name: 'System Owner',
      });

      // Create non-owner
      nonOwner = await userRepository.save({
        email: `nonowner-${timestamp}@example.com`,
        name: 'Non Owner',
      });

      // Make systemOwner an owner of testSystem
      ownerRepo = module.get<Repository<SystemOwner>>(getRepositoryToken(SystemOwner));
      await ownerRepo.save(
        ownerRepo.create({
          userId: systemOwner.id,
          systemId: testSystem.id,
        }),
      );
    });

    describe('markToRemove', () => {
      it('system owner can mark active grant as to_remove', async () => {
        const grant = await accessGrantService.create({
          userId: testUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        });
        expect(grant.status).toBe(AccessGrantStatus.ACTIVE);

        const marked = await accessGrantService.markToRemove(grant.id, systemOwner.id);
        expect(marked.status).toBe(AccessGrantStatus.TO_REMOVE);
        expect(marked.removedAt).toBeNull();
      });

      it('non-owner cannot mark grant for removal', async () => {
        const grant = await accessGrantService.create({
          userId: testUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        });

        await expect(
          accessGrantService.markToRemove(grant.id, nonOwner.id),
        ).rejects.toThrow('not authorized');
      });

      it('cannot mark non-active grant for removal', async () => {
        const grant = await accessGrantService.create({
          userId: testUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
          status: AccessGrantStatus.REMOVED,
        });

        await expect(
          accessGrantService.markToRemove(grant.id, systemOwner.id),
        ).rejects.toThrow('must be in \'active\' status');
      });
    });

    describe('markRemoved', () => {
      it('system owner can mark to_remove grant as removed', async () => {
        const grant = await accessGrantService.create({
          userId: testUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        });
        
        // First mark for removal
        await accessGrantService.markToRemove(grant.id, systemOwner.id);
        
        // Then mark as removed
        const removed = await accessGrantService.markRemoved(grant.id, systemOwner.id);
        expect(removed.status).toBe(AccessGrantStatus.REMOVED);
        expect(removed.removedAt).toBeDefined();
        expect(removed.removedAt).not.toBeNull();
      });

      it('removedAt is set when marking as removed', async () => {
        const grant = await accessGrantService.create({
          userId: testUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        });
        
        await accessGrantService.markToRemove(grant.id, systemOwner.id);
        
        const before = new Date();
        const removed = await accessGrantService.markRemoved(grant.id, systemOwner.id);
        const after = new Date();

        expect(removed.removedAt).toBeDefined();
        if (removed.removedAt) {
          const removedAtTime = new Date(removed.removedAt).getTime();
          expect(removedAtTime).toBeGreaterThanOrEqual(before.getTime());
          expect(removedAtTime).toBeLessThanOrEqual(after.getTime());
        }
      });

      it('non-owner cannot mark grant as removed', async () => {
        const grant = await accessGrantService.create({
          userId: testUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        });
        await accessGrantService.markToRemove(grant.id, systemOwner.id);

        await expect(
          accessGrantService.markRemoved(grant.id, nonOwner.id),
        ).rejects.toThrow('not authorized');
      });

      it('cannot mark non-to_remove grant as removed', async () => {
        const grant = await accessGrantService.create({
          userId: testUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        });

        await expect(
          accessGrantService.markRemoved(grant.id, systemOwner.id),
        ).rejects.toThrow('must be in \'to_remove\' status');
      });
    });

    describe('cancelRemoval', () => {
      it('system owner can cancel removal (to_remove → active)', async () => {
        const grant = await accessGrantService.create({
          userId: testUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        });
        
        await accessGrantService.markToRemove(grant.id, systemOwner.id);
        expect((await accessGrantRepository.findOne({ where: { id: grant.id } }))?.status).toBe(AccessGrantStatus.TO_REMOVE);
        
        const cancelled = await accessGrantService.cancelRemoval(grant.id, systemOwner.id);
        expect(cancelled.status).toBe(AccessGrantStatus.ACTIVE);
        expect(cancelled.removedAt).toBeNull();
      });

      it('non-owner cannot cancel removal', async () => {
        const grant = await accessGrantService.create({
          userId: testUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        });
        await accessGrantService.markToRemove(grant.id, systemOwner.id);

        await expect(
          accessGrantService.cancelRemoval(grant.id, nonOwner.id),
        ).rejects.toThrow('not authorized');
      });

      it('cannot cancel removal for non-to_remove grant', async () => {
        const grant = await accessGrantService.create({
          userId: testUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        });

        await expect(
          accessGrantService.cancelRemoval(grant.id, systemOwner.id),
        ).rejects.toThrow('must be in \'to_remove\' status');
      });
    });

    describe('findPendingRemoval', () => {
      it('returns only to_remove grants for owned systems', async () => {
        // Create another system owner doesn't own
        const otherSystem = await systemRepository.save({
          name: `Other System ${Date.now()}`,
          description: 'Test',
        });
        const otherInstance = await systemInstanceRepository.save({
          systemId: otherSystem.id,
          name: `Other Instance ${Date.now()}`,
          region: 'US',
        });
        const otherTier = await accessTierRepository.save({
          systemId: otherSystem.id,
          name: `other-tier-${Date.now()}`,
          description: 'Test',
        });

        // Create another owner for the other system
        const otherOwner = await userRepository.save({
          email: `otherowner-${Date.now()}@example.com`,
          name: 'Other Owner',
        });
        await ownerRepo.save(
          ownerRepo.create({
            userId: otherOwner.id,
            systemId: otherSystem.id,
          }),
        );

        // Create grants for both systems
        const ownedGrant = await accessGrantService.create({
          userId: testUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        });
        const otherGrant = await accessGrantService.create({
          userId: testUser.id,
          systemInstanceId: otherInstance.id,
          accessTierId: otherTier.id,
        });

        // Mark both for removal (each by their respective owner)
        await accessGrantService.markToRemove(ownedGrant.id, systemOwner.id);
        await accessGrantService.markToRemove(otherGrant.id, otherOwner.id);

        // Should only see grant for owned system
        const pending = await accessGrantService.findPendingRemoval(systemOwner.id);
        expect(pending.length).toBe(1);
        expect(pending[0].id).toBe(ownedGrant.id);
      });

      it('excludes non-to_remove grants', async () => {
        const activeGrant = await accessGrantService.create({
          userId: testUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        });
        const removedGrant = await accessGrantService.create({
          userId: testUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
          status: AccessGrantStatus.REMOVED,
        });

        const pending = await accessGrantService.findPendingRemoval(systemOwner.id);
        expect(pending.length).toBe(0);
      });
    });

    describe('bulk operations', () => {
      it('bulkMarkToRemove processes multiple grants', async () => {
        // Create different users to avoid duplicate grant conflicts
        const user1 = await userRepository.save({
          email: `user1-${Date.now()}@example.com`,
          name: 'User 1',
        });
        const user2 = await userRepository.save({
          email: `user2-${Date.now()}@example.com`,
          name: 'User 2',
        });

        const grant1 = await accessGrantService.create({
          userId: user1.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        });
        const grant2 = await accessGrantService.create({
          userId: user2.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        });

        const result = await accessGrantService.bulkMarkToRemove(
          [grant1.id, grant2.id],
          systemOwner.id,
        );

        expect(result.successful.length).toBe(2);
        expect(result.failed.length).toBe(0);
        expect(result.successful[0].status).toBe(AccessGrantStatus.TO_REMOVE);
        expect(result.successful[1].status).toBe(AccessGrantStatus.TO_REMOVE);
      });

      it('bulkMarkToRemove handles failures gracefully', async () => {
        const grant = await accessGrantService.create({
          userId: testUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        });

        // Try with non-owner (will fail)
        const result = await accessGrantService.bulkMarkToRemove(
          [grant.id],
          nonOwner.id,
        );

        expect(result.successful.length).toBe(0);
        expect(result.failed.length).toBe(1);
        expect(result.failed[0].reason).toContain('not authorized');
      });

      it('bulkMarkRemoved processes multiple grants', async () => {
        // Create different users to avoid duplicate grant conflicts
        const user1 = await userRepository.save({
          email: `user1-${Date.now()}@example.com`,
          name: 'User 1',
        });
        const user2 = await userRepository.save({
          email: `user2-${Date.now()}@example.com`,
          name: 'User 2',
        });

        const grant1 = await accessGrantService.create({
          userId: user1.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        });
        const grant2 = await accessGrantService.create({
          userId: user2.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
        });

        // Mark both for removal first
        await accessGrantService.markToRemove(grant1.id, systemOwner.id);
        await accessGrantService.markToRemove(grant2.id, systemOwner.id);

        const result = await accessGrantService.bulkMarkRemoved(
          [grant1.id, grant2.id],
          systemOwner.id,
        );

        expect(result.successful.length).toBe(2);
        expect(result.failed.length).toBe(0);
        expect(result.successful[0].status).toBe(AccessGrantStatus.REMOVED);
        expect(result.successful[1].status).toBe(AccessGrantStatus.REMOVED);
      });
    });
  });
});




