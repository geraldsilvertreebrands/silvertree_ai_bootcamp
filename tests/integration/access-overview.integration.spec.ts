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
import { AccessGrantQueryService } from '../../src/access-control/services/access-grant-query.service';
import { AccessOverviewController } from '../../src/access-control/controllers/access-overview.controller';

describe('Access Overview (Integration)', () => {
  let queryService: AccessGrantQueryService;
  let controller: AccessOverviewController;
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
  let testInstance2: SystemInstance;
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
          entities: [User, System, SystemInstance, AccessTier, AccessGrant],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([User, System, SystemInstance, AccessTier, AccessGrant]),
      ],
      controllers: [AccessOverviewController],
      providers: [AccessGrantQueryService],
    }).compile();

    queryService = module.get<AccessGrantQueryService>(AccessGrantQueryService);
    controller = module.get<AccessOverviewController>(AccessOverviewController);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    systemRepository = module.get<Repository<System>>(getRepositoryToken(System));
    systemInstanceRepository = module.get<Repository<SystemInstance>>(
      getRepositoryToken(SystemInstance),
    );
    accessTierRepository = module.get<Repository<AccessTier>>(getRepositoryToken(AccessTier));
    accessGrantRepository = module.get<Repository<AccessGrant>>(getRepositoryToken(AccessGrant));

    // Create test data with unique timestamp + random component
    const timestamp = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    testUser1 = await userRepository.save({
      email: `user1-${timestamp}@example.com`,
      name: 'John Doe',
    });
    testUser2 = await userRepository.save({
      email: `user2-${timestamp}@example.com`,
      name: 'Jane Smith',
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
    testInstance2 = await systemInstanceRepository.save({
      systemId: testSystem.id,
      name: `Instance 2 ${timestamp}`,
      region: 'EU',
    });

    testTier1 = await accessTierRepository.save({
      systemId: testSystem.id,
      name: `admin-${timestamp}`,
      description: 'Admin access',
    });
    testTier2 = await accessTierRepository.save({
      systemId: testSystem.id,
      name: `readonly-${timestamp}`,
      description: 'Read-only access',
    });
  });

  afterAll(async () => {
    try {
      // Clean up in reverse order of dependencies
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

  describe('AccessGrantQueryService', () => {
    beforeEach(async () => {
      // Clean up grants before each test
      await accessGrantRepository.clear();
      
      // Always recreate test fixtures for isolation (generate unique IDs each time)
      const timestamp = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      testUser1 = await userRepository.save({
        email: `user1-${timestamp}@example.com`,
        name: 'John Doe',
      });
      testUser2 = await userRepository.save({
        email: `user2-${timestamp}@example.com`,
        name: 'Jane Smith',
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
      testInstance2 = await systemInstanceRepository.save({
        systemId: testSystem.id,
        name: `Instance 2 ${timestamp}`,
        region: 'EU',
      });
      testTier1 = await accessTierRepository.save({
        systemId: testSystem.id,
        name: `admin-${timestamp}`,
        description: 'Admin access',
      });
      testTier2 = await accessTierRepository.save({
        systemId: testSystem.id,
        name: `readonly-${timestamp}`,
        description: 'Read-only access',
      });
    });

    describe('findAll', () => {
      it('should return all grants with relations', async () => {
        const grant1 = await accessGrantRepository.save({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
          status: AccessGrantStatus.ACTIVE,
          grantedAt: new Date(),
        });
        const grant2 = await accessGrantRepository.save({
          userId: testUser2.id,
          systemInstanceId: testInstance2.id,
          accessTierId: testTier2.id,
          status: AccessGrantStatus.ACTIVE,
          grantedAt: new Date(),
        });

        const result = await queryService.findAll({});

        expect(result.data.length).toBeGreaterThanOrEqual(2);
        expect(result.total).toBeGreaterThanOrEqual(2);
        expect(result.data[0]).toHaveProperty('user');
        expect(result.data[0]).toHaveProperty('systemInstance');
        expect(result.data[0]).toHaveProperty('accessTier');
      });

      it('should filter by userId', async () => {
        await accessGrantRepository.save({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
          status: AccessGrantStatus.ACTIVE,
        });
        await accessGrantRepository.save({
          userId: testUser2.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
          status: AccessGrantStatus.ACTIVE,
        });

        const result = await queryService.findAll({ userId: testUser1.id });

        expect(result.data.length).toBe(1);
        expect(result.data[0].userId).toBe(testUser1.id);
      });

      it('should filter by systemId', async () => {
        const timestamp = Date.now();
        const system2 = await systemRepository.save({
          name: `System 2 ${timestamp}`,
        });
        const instance3 = await systemInstanceRepository.save({
          systemId: system2.id,
          name: `Instance 3 ${timestamp}`,
        });
        const tier3 = await accessTierRepository.save({
          systemId: system2.id,
          name: `tier-${timestamp}`,
          description: 'Tier for system2',
        });

        // Verify test fixtures exist (reload from DB)
        const userCheck = await userRepository.findOne({ where: { id: testUser1.id } });
        const instanceCheck = await systemInstanceRepository.findOne({ where: { id: testInstance1.id } });
        const tierCheck = await accessTierRepository.findOne({ where: { id: testTier1.id } });
        expect(userCheck).toBeDefined();
        expect(instanceCheck).toBeDefined();
        expect(tierCheck).toBeDefined();

        await accessGrantRepository.save({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
          status: AccessGrantStatus.ACTIVE,
        });
        await accessGrantRepository.save({
          userId: testUser1.id,
          systemInstanceId: instance3.id,
          accessTierId: tier3.id,
          status: AccessGrantStatus.ACTIVE,
        });

        const result = await queryService.findAll({
          systemId: testSystem.id,
        });

        expect(result.data.length).toBe(1);
        expect(result.data[0].systemInstance.systemId).toBe(testSystem.id);
      });

      it('should filter by systemInstanceId', async () => {
        await accessGrantRepository.save({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
          status: AccessGrantStatus.ACTIVE,
        });
        await accessGrantRepository.save({
          userId: testUser1.id,
          systemInstanceId: testInstance2.id,
          accessTierId: testTier1.id,
          status: AccessGrantStatus.ACTIVE,
        });

        const result = await queryService.findAll({
          systemInstanceId: testInstance1.id,
        });

        expect(result.data.length).toBe(1);
        expect(result.data[0].systemInstanceId).toBe(testInstance1.id);
      });

      it('should filter by accessTierId', async () => {
        await accessGrantRepository.save({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
          status: AccessGrantStatus.ACTIVE,
        });
        await accessGrantRepository.save({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier2.id,
          status: AccessGrantStatus.ACTIVE,
        });

        const result = await queryService.findAll({
          accessTierId: testTier1.id,
        });

        expect(result.data.length).toBe(1);
        expect(result.data[0].accessTierId).toBe(testTier1.id);
      });

      it('should filter by status', async () => {
        await accessGrantRepository.save({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
          status: AccessGrantStatus.ACTIVE,
        });
        await accessGrantRepository.save({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
          status: AccessGrantStatus.REMOVED,
          removedAt: new Date(),
        });

        const result = await queryService.findAll({
          status: AccessGrantStatus.ACTIVE,
        });

        expect(result.data.length).toBe(1);
        expect(result.data[0].status).toBe(AccessGrantStatus.ACTIVE);
      });

      it('should filter by to_remove status', async () => {
        await accessGrantRepository.save({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
          status: AccessGrantStatus.TO_REMOVE,
        });
        await accessGrantRepository.save({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
          status: AccessGrantStatus.ACTIVE,
        });

        const result = await queryService.findAll({
          status: AccessGrantStatus.TO_REMOVE,
        });

        expect(result.data.length).toBe(1);
        expect(result.data[0].status).toBe(AccessGrantStatus.TO_REMOVE);
      });

      it('should combine multiple filters', async () => {
        await accessGrantRepository.save({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
          status: AccessGrantStatus.ACTIVE,
        });
        await accessGrantRepository.save({
          userId: testUser2.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
          status: AccessGrantStatus.ACTIVE,
        });
        await accessGrantRepository.save({
          userId: testUser1.id,
          systemInstanceId: testInstance2.id,
          accessTierId: testTier1.id,
          status: AccessGrantStatus.ACTIVE,
        });

        const result = await queryService.findAll({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
        });

        expect(result.data.length).toBe(1);
        expect(result.data[0].userId).toBe(testUser1.id);
        expect(result.data[0].systemInstanceId).toBe(testInstance1.id);
      });

      it('should support pagination', async () => {
        // Create 5 grants with different combinations to avoid unique constraint
        await accessGrantRepository.save({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
          status: AccessGrantStatus.ACTIVE,
        });
        await accessGrantRepository.save({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier2.id,
          status: AccessGrantStatus.ACTIVE,
        });
        await accessGrantRepository.save({
          userId: testUser1.id,
          systemInstanceId: testInstance2.id,
          accessTierId: testTier1.id,
          status: AccessGrantStatus.ACTIVE,
        });
        await accessGrantRepository.save({
          userId: testUser2.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
          status: AccessGrantStatus.ACTIVE,
        });
        await accessGrantRepository.save({
          userId: testUser2.id,
          systemInstanceId: testInstance2.id,
          accessTierId: testTier2.id,
          status: AccessGrantStatus.ACTIVE,
        });

        const result = await queryService.findAll({
          page: 1,
          limit: 2,
        });

        expect(result.data.length).toBe(2);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(2);
        expect(result.total).toBeGreaterThanOrEqual(5);
        expect(result.totalPages).toBeGreaterThanOrEqual(3);
      });

      it('should support sorting by grantedAt descending (default)', async () => {
        const grant1 = await accessGrantRepository.save({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier1.id,
          status: AccessGrantStatus.ACTIVE,
          grantedAt: new Date('2024-01-01'),
        });
        const grant2 = await accessGrantRepository.save({
          userId: testUser1.id,
          systemInstanceId: testInstance1.id,
          accessTierId: testTier2.id, // Different tier to avoid unique constraint
          status: AccessGrantStatus.ACTIVE,
          grantedAt: new Date('2024-01-02'),
        });

        const result = await queryService.findAll({});

        expect(result.data.length).toBeGreaterThanOrEqual(2);
        // Most recent first
        const firstGrant = result.data.find((g: AccessGrant) => g.id === grant2.id);
        const secondGrant = result.data.find((g: AccessGrant) => g.id === grant1.id);
        expect(result.data.indexOf(firstGrant!)).toBeLessThan(result.data.indexOf(secondGrant!));
      });
    });
  });

  describe('AccessOverviewController', () => {
    beforeEach(async () => {
      await accessGrantRepository.clear();
      
      // Verify test data exists, recreate if missing
      const user1Exists = await userRepository.findOne({ where: { id: testUser1.id } });
      if (!user1Exists) {
        const timestamp = Date.now();
        testUser1 = await userRepository.save({
          email: `user1-${timestamp}@example.com`,
          name: 'John Doe',
        });
        testUser2 = await userRepository.save({
          email: `user2-${timestamp}@example.com`,
          name: 'Jane Smith',
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
        testInstance2 = await systemInstanceRepository.save({
          systemId: testSystem.id,
          name: `Instance 2 ${timestamp}`,
          region: 'EU',
        });
        testTier1 = await accessTierRepository.save({
          systemId: testSystem.id,
          name: `admin-${timestamp}`,
          description: 'Admin access',
        });
        testTier2 = await accessTierRepository.save({
          systemId: testSystem.id,
          name: `readonly-${timestamp}`,
          description: 'Read-only access',
        });
      }
    });

    it('GET /api/v1/access-overview should return all grants', async () => {
      await accessGrantRepository.save({
        userId: testUser1.id,
        systemInstanceId: testInstance1.id,
        accessTierId: testTier1.id,
        status: AccessGrantStatus.ACTIVE,
        grantedAt: new Date(),
      });

      const result = await controller.findAll({});

      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/access-overview should filter by userId', async () => {
      await accessGrantRepository.save({
        userId: testUser1.id,
        systemInstanceId: testInstance1.id,
        accessTierId: testTier1.id,
        status: AccessGrantStatus.ACTIVE,
      });
      await accessGrantRepository.save({
        userId: testUser2.id,
        systemInstanceId: testInstance1.id,
        accessTierId: testTier1.id,
        status: AccessGrantStatus.ACTIVE,
      });

      const result = await controller.findAll({ userId: testUser1.id });

      expect(result.data.length).toBe(1);
      expect(result.data[0].userId).toBe(testUser1.id);
    });

    it('GET /api/v1/access-overview should filter by status', async () => {
      await accessGrantRepository.save({
        userId: testUser1.id,
        systemInstanceId: testInstance1.id,
        accessTierId: testTier1.id,
        status: AccessGrantStatus.ACTIVE,
      });
      await accessGrantRepository.save({
        userId: testUser1.id,
        systemInstanceId: testInstance1.id,
        accessTierId: testTier1.id,
        status: AccessGrantStatus.REMOVED,
        removedAt: new Date(),
      });

      const result = await controller.findAll({
        status: AccessGrantStatus.ACTIVE,
      });

      expect(result.data.length).toBe(1);
      expect(result.data[0].status).toBe(AccessGrantStatus.ACTIVE);
    });

    it('GET /api/v1/access-overview should support pagination', async () => {
      // Create 3 grants with different combinations
      await accessGrantRepository.save({
        userId: testUser1.id,
        systemInstanceId: testInstance1.id,
        accessTierId: testTier1.id,
        status: AccessGrantStatus.ACTIVE,
      });
      await accessGrantRepository.save({
        userId: testUser1.id,
        systemInstanceId: testInstance1.id,
        accessTierId: testTier2.id,
        status: AccessGrantStatus.ACTIVE,
      });
      await accessGrantRepository.save({
        userId: testUser1.id,
        systemInstanceId: testInstance2.id,
        accessTierId: testTier1.id,
        status: AccessGrantStatus.ACTIVE,
      });

      const result = await controller.findAll({ page: 1, limit: 2 });

      expect(result.data.length).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(result.total).toBeGreaterThanOrEqual(3);
    });

    it('GET /api/v1/access-overview should include all required fields', async () => {
      const grant = await accessGrantRepository.save({
        userId: testUser1.id,
        systemInstanceId: testInstance1.id,
        accessTierId: testTier1.id,
        status: AccessGrantStatus.ACTIVE,
        grantedAt: new Date(),
      });

      const result = await controller.findAll({ userId: testUser1.id });

      expect(result.data.length).toBe(1);
      const grantData = result.data[0];
      expect(grantData).toHaveProperty('id');
      expect(grantData).toHaveProperty('user');
      expect(grantData.user).toHaveProperty('name');
      expect(grantData.user).toHaveProperty('email');
      expect(grantData).toHaveProperty('systemInstance');
      expect(grantData.systemInstance).toHaveProperty('system');
      expect(grantData.systemInstance.system).toHaveProperty('name');
      expect(grantData.systemInstance).toHaveProperty('name');
      expect(grantData).toHaveProperty('accessTier');
      expect(grantData.accessTier).toHaveProperty('name');
      expect(grantData).toHaveProperty('status');
      expect(grantData).toHaveProperty('grantedAt');
    });
  });
});
