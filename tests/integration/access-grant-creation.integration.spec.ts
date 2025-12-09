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
import { AccessGrantService } from '../../src/access-control/services/access-grant.service';
import { AccessControlModule } from '../../src/access-control/access-control.module';
import { IdentityModule } from '../../src/identity/identity.module';
import { SystemsModule } from '../../src/systems/systems.module';
import { OwnershipModule } from '../../src/ownership/ownership.module';
import { AuthModule } from '../../src/auth/auth.module';

describe('Access Grant Creation (Integration)', () => {
  let accessGrantService: AccessGrantService;
  let userRepository: Repository<User>;
  let systemRepository: Repository<System>;
  let systemInstanceRepository: Repository<SystemInstance>;
  let accessTierRepository: Repository<AccessTier>;
  let accessGrantRepository: Repository<AccessGrant>;
  let module: TestingModule;

  let testUser1: User;
  let testUser2: User;
  let testSystem: System;
  let testInstance1: SystemInstance;
  let testTier1: AccessTier;
  let testTier2: AccessTier;

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
        IdentityModule,
        SystemsModule,
        OwnershipModule,
        AuthModule,
        AccessControlModule,
      ],
    }).compile();

    accessGrantService = module.get<AccessGrantService>(AccessGrantService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    systemRepository = module.get<Repository<System>>(getRepositoryToken(System));
    systemInstanceRepository = module.get<Repository<SystemInstance>>(
      getRepositoryToken(SystemInstance),
    );
    accessTierRepository = module.get<Repository<AccessTier>>(getRepositoryToken(AccessTier));
    accessGrantRepository = module.get<Repository<AccessGrant>>(getRepositoryToken(AccessGrant));

    // Create test data
    const timestamp = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    testUser1 = await userRepository.save({
      email: `user1-${timestamp}@example.com`,
      name: 'Test User 1',
    });
    testUser2 = await userRepository.save({
      email: `user2-${timestamp}@example.com`,
      name: 'Test User 2',
    });

    testSystem = await systemRepository.save({
      name: `Test System ${timestamp}`,
      description: 'Test',
    });

    testInstance1 = await systemInstanceRepository.save({
      systemId: testSystem.id,
      name: `Instance 1 ${timestamp}`,
      region: 'US',
    });

    testTier1 = await accessTierRepository.save({
      systemId: testSystem.id,
      name: `admin-${timestamp}`,
      description: 'Admin access',
    });

    testTier2 = await accessTierRepository.save({
      systemId: testSystem.id,
      name: `viewer-${timestamp}`,
      description: 'Viewer access',
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
    const user1Exists = await userRepository.findOne({ where: { id: testUser1.id } });
    const instance1Exists = await systemInstanceRepository.findOne({
      where: { id: testInstance1.id },
    });
    const tier1Exists = await accessTierRepository.findOne({ where: { id: testTier1.id } });

    if (!user1Exists || !instance1Exists || !tier1Exists) {
      const timestamp = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      testUser1 = await userRepository.save({
        email: `user1-${timestamp}@example.com`,
        name: 'Test User 1',
      });
      testUser2 = await userRepository.save({
        email: `user2-${timestamp}@example.com`,
        name: 'Test User 2',
      });
      testSystem = await systemRepository.save({
        name: `Test System ${timestamp}`,
        description: 'Test',
      });
      testInstance1 = await systemInstanceRepository.save({
        systemId: testSystem.id,
        name: `Instance 1 ${timestamp}`,
        region: 'US',
      });
      testTier1 = await accessTierRepository.save({
        systemId: testSystem.id,
        name: `admin-${timestamp}`,
        description: 'Admin access',
      });
      testTier2 = await accessTierRepository.save({
        systemId: testSystem.id,
        name: `viewer-${timestamp}`,
        description: 'Viewer access',
      });
    }
  });

  describe('AccessGrantService', () => {
    describe('create', () => {
      it('should create an access grant successfully', async () => {
        const grant = await accessGrantService.create({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
        });

        expect(grant.id).toBeDefined();
        expect(grant.userId).toBe(testUser1.id);
        expect(grant.systemInstanceId).toBe(testInstance1.id);
        expect(grant.accessTierId).toBe(testTier1.id);
        expect(grant.status).toBe(AccessGrantStatus.ACTIVE);
        expect(grant.grantedAt).toBeDefined();
        expect(grant.user).toBeDefined();
        expect(grant.systemInstance).toBeDefined();
        expect(grant.systemInstance.system).toBeDefined();
        expect(grant.accessTier).toBeDefined();
      });

      it('should set default status to active', async () => {
        const grant = await accessGrantService.create({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
        });

        expect(grant.status).toBe(AccessGrantStatus.ACTIVE);
      });

      it('should set default grantedAt to now', async () => {
        const before = new Date();
        const grant = await accessGrantService.create({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
        });
        const after = new Date();

        expect(grant.grantedAt).toBeDefined();
        expect(grant.grantedAt).not.toBeNull();
        if (grant.grantedAt) {
          expect(new Date(grant.grantedAt).getTime()).toBeGreaterThanOrEqual(before.getTime());
          expect(new Date(grant.grantedAt).getTime()).toBeLessThanOrEqual(after.getTime());
        }
      });

      it('should allow custom grantedAt', async () => {
        const customDate = new Date('2024-01-01T00:00:00Z');
        const grant = await accessGrantService.create({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
          grantedAt: customDate.toISOString(),
        });

        expect(grant.grantedAt).toBeDefined();
        if (grant.grantedAt) {
          expect(new Date(grant.grantedAt).toISOString()).toBe(customDate.toISOString());
        }
      });

      it('should allow specifying grantedById', async () => {
        const grant = await accessGrantService.create({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
          grantedById: testUser2.id,
        });

        expect(grant.grantedById).toBe(testUser2.id);
        expect(grant.grantedBy).toBeDefined();
        expect(grant.grantedBy).not.toBeNull();
        if (grant.grantedBy) {
          expect(grant.grantedBy.id).toBe(testUser2.id);
        }
      });

      it('should throw NotFoundException when user does not exist', async () => {
        const fakeUserId = '00000000-0000-0000-0000-000000000000';

        await expect(
          accessGrantService.create({
            userId: fakeUserId,
            systemInstanceId: testInstance1.id,
            accessTierId: testTier1.id,
          }),
        ).rejects.toThrow('User with ID 00000000-0000-0000-0000-000000000000 not found');
      });

      it('should throw NotFoundException when system instance does not exist', async () => {
        const fakeInstanceId = '00000000-0000-0000-0000-000000000000';

        await expect(
          accessGrantService.create({
            userId: testUser1.id,
            systemInstanceId: fakeInstanceId,
            accessTierId: testTier1.id,
          }),
        ).rejects.toThrow('SystemInstance with ID 00000000-0000-0000-0000-000000000000 not found');
      });

      it('should throw NotFoundException when access tier does not exist', async () => {
        const fakeTierId = '00000000-0000-0000-0000-000000000000';

        await expect(
          accessGrantService.create({
            userId: testUser1.id,
            systemInstanceId: testInstance1.id,
            accessTierId: fakeTierId,
          }),
        ).rejects.toThrow('AccessTier with ID 00000000-0000-0000-0000-000000000000 not found');
      });

      it('should throw UnprocessableEntityException when tier does not belong to system', async () => {
        // Create another system and tier
        const timestamp = Date.now();
        const system2 = await systemRepository.save({
          name: `System 2 ${timestamp}`,
        });
        const tier2 = await accessTierRepository.save({
          systemId: system2.id,
          name: `tier-${timestamp}`,
        });

        await expect(
          accessGrantService.create({
            userId: testUser1.id,
            systemInstanceId: testInstance1.id,
            accessTierId: tier2.id, // Tier from different system
          }),
        ).rejects.toThrow('does not belong to system');
      });

      it('should throw ConflictException when duplicate active grant exists', async () => {
        // Create first grant
        await accessGrantService.create({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
        });

        // Try to create duplicate
        await expect(
          accessGrantService.create({
            userId: testUser1.id,
            systemInstanceId: testInstance1.id,
            accessTierId: testTier1.id,
          }),
        ).rejects.toThrow('Active grant already exists');
      });

      it('should allow multiple removed grants', async () => {
        const grant1 = await accessGrantService.create({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
          status: AccessGrantStatus.REMOVED,
        });

        const grant2 = await accessGrantService.create({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
          status: AccessGrantStatus.REMOVED,
        });

        expect(grant1.id).toBeDefined();
        expect(grant2.id).toBeDefined();
        expect(grant1.id).not.toBe(grant2.id);
        expect(grant1.status).toBe(AccessGrantStatus.REMOVED);
        expect(grant2.status).toBe(AccessGrantStatus.REMOVED);
      });

      it('should allow same user to have different tiers on same instance', async () => {
        const grant1 = await accessGrantService.create({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
        });

        const grant2 = await accessGrantService.create({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier2.id,
        });

        expect(grant1.id).not.toBe(grant2.id);
        expect(grant1.accessTierId).toBe(testTier1.id);
        expect(grant2.accessTierId).toBe(testTier2.id);
      });
    });
  });

  // Note: Controller tests are covered in API integration tests
  // This test suite focuses on service-level integration
});

