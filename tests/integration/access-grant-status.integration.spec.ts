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
          entities: [User, System, SystemInstance, AccessTier, AccessGrant],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([User, System, SystemInstance, AccessTier, AccessGrant]),
      ],
      controllers: [AccessGrantsController],
      providers: [AccessGrantService],
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
  });
});




