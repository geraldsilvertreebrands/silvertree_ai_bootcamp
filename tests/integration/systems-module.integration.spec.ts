import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { System } from '../../src/systems/entities/system.entity';
import { SystemInstance } from '../../src/systems/entities/system-instance.entity';
import { AccessTier } from '../../src/systems/entities/access-tier.entity';
import { SystemService } from '../../src/systems/services/system.service';
import { SystemInstanceService } from '../../src/systems/services/system-instance.service';
import { AccessTierService } from '../../src/systems/services/access-tier.service';
import { SystemsController } from '../../src/systems/controllers/systems.controller';
import { SystemInstancesController } from '../../src/systems/controllers/system-instances.controller';
import { AccessTiersController } from '../../src/systems/controllers/access-tiers.controller';

describe('Systems Module (Integration)', () => {
  let systemService: SystemService;
  let systemInstanceService: SystemInstanceService;
  let accessTierService: AccessTierService;
  let systemRepository: Repository<System>;
  let systemInstanceRepository: Repository<SystemInstance>;
  let accessTierRepository: Repository<AccessTier>;
  let module: TestingModule;

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
          entities: [System, SystemInstance, AccessTier],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([System, SystemInstance, AccessTier]),
      ],
      controllers: [SystemsController, SystemInstancesController, AccessTiersController],
      providers: [SystemService, SystemInstanceService, AccessTierService],
    }).compile();

    systemService = module.get<SystemService>(SystemService);
    systemInstanceService = module.get<SystemInstanceService>(SystemInstanceService);
    accessTierService = module.get<AccessTierService>(AccessTierService);
    systemRepository = module.get<Repository<System>>(getRepositoryToken(System));
    systemInstanceRepository = module.get<Repository<SystemInstance>>(
      getRepositoryToken(SystemInstance),
    );
    accessTierRepository = module.get<Repository<AccessTier>>(getRepositoryToken(AccessTier));
  });

  afterAll(async () => {
    try {
      // Don't clean up - let each test suite manage its own data
      // This prevents foreign key violations in other test suites
    } catch (error) {
      // Ignore cleanup errors
    }
    await module.close();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  describe('SystemService', () => {
    describe('create', () => {
      it('should create a system', async () => {
        const timestamp = Date.now();
        const createSystemDto = {
          name: `Test System ${timestamp}`,
          description: 'Test Description',
        };

        const system = await systemService.create(createSystemDto);

        expect(system.id).toBeDefined();
        expect(system.name).toBe(`Test System ${timestamp}`);
        expect(system.description).toBe('Test Description');
      });

      it('should prevent duplicate system names', async () => {
        const timestamp = Date.now();
        const name = `Duplicate System ${timestamp}`;
        await systemService.create({ name, description: 'First' });

        await expect(systemService.create({ name, description: 'Second' })).rejects.toThrow();
      });
    });

    describe('findById', () => {
      it('should find system by ID', async () => {
        const timestamp = Date.now();
        const created = await systemService.create({
          name: `Find System ${timestamp}`,
        });

        const found = await systemService.findById(created.id);

        expect(found).toBeDefined();
        expect(found).not.toBeNull();
        if (found) {
          expect(found.id).toBe(created.id);
          expect(found.name).toBe(`Find System ${timestamp}`);
        }
      });

      it('should return null if system not found', async () => {
        const found = await systemService.findById('00000000-0000-0000-0000-000000000000');
        expect(found).toBeNull();
      });
    });

    describe('findAll', () => {
      it('should return list of systems', async () => {
        const timestamp = Date.now();
        await systemService.create({ name: `System 1 ${timestamp}` });
        await systemService.create({ name: `System 2 ${timestamp}` });

        const systems = await systemService.findAll();

        expect(Array.isArray(systems)).toBe(true);
        expect(systems.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('update', () => {
      it('should update system', async () => {
        const timestamp = Date.now();
        const created = await systemService.create({
          name: `Update System ${timestamp}`,
          description: 'Original',
        });

        const updated = await systemService.update(created.id, {
          description: 'Updated',
        });

        expect(updated.description).toBe('Updated');
        expect(updated.name).toBe(`Update System ${timestamp}`);
      });
    });
  });

  describe('SystemInstanceService', () => {
    let testSystem: System;

    beforeEach(async () => {
      const timestamp = Date.now();
      testSystem = await systemService.create({
        name: `Test System Instance ${timestamp}`,
      });
    });

    describe('create', () => {
      it('should create a system instance', async () => {
        const timestamp = Date.now();
        const createInstanceDto = {
          systemId: testSystem.id,
          name: `Instance ${timestamp}`,
          region: 'US',
          environment: 'production',
        };

        const instance = await systemInstanceService.create(createInstanceDto);

        expect(instance.id).toBeDefined();
        expect(instance.systemId).toBe(testSystem.id);
        expect(instance.name).toBe(`Instance ${timestamp}`);
        expect(instance.region).toBe('US');
      });

      it('should prevent duplicate instance names per system', async () => {
        const timestamp = Date.now();
        const name = `Duplicate Instance ${timestamp}`;
        await systemInstanceService.create({
          systemId: testSystem.id,
          name,
        });

        await expect(
          systemInstanceService.create({
            systemId: testSystem.id,
            name,
          }),
        ).rejects.toThrow();
      });

      it('should allow same instance name for different systems', async () => {
        const timestamp = Date.now();
        const name = `Same Name ${timestamp}`;
        const system2 = await systemService.create({
          name: `System 2 ${timestamp}`,
        });

        const instance1 = await systemInstanceService.create({
          systemId: testSystem.id,
          name,
        });
        const instance2 = await systemInstanceService.create({
          systemId: system2.id,
          name,
        });

        expect(instance1.name).toBe(name);
        expect(instance2.name).toBe(name);
        expect(instance1.systemId).not.toBe(instance2.systemId);
      });
    });

    describe('findBySystemId', () => {
      it('should find all instances for a system', async () => {
        const timestamp = Date.now();
        await systemInstanceService.create({
          systemId: testSystem.id,
          name: `Instance 1 ${timestamp}`,
        });
        await systemInstanceService.create({
          systemId: testSystem.id,
          name: `Instance 2 ${timestamp}`,
        });

        const instances = await systemInstanceService.findBySystemId(testSystem.id);

        expect(instances.length).toBeGreaterThanOrEqual(2);
        instances.forEach((instance: SystemInstance) => {
          expect(instance.systemId).toBe(testSystem.id);
        });
      });
    });
  });

  describe('AccessTierService', () => {
    let testSystem: System;

    beforeEach(async () => {
      const timestamp = Date.now();
      testSystem = await systemService.create({
        name: `Test System Tier ${timestamp}`,
      });
    });

    describe('create', () => {
      it('should create an access tier', async () => {
        const timestamp = Date.now();
        const createTierDto = {
          systemId: testSystem.id,
          name: `tier-${timestamp}`,
          description: 'Test Tier',
        };

        const tier = await accessTierService.create(createTierDto);

        expect(tier.id).toBeDefined();
        expect(tier.systemId).toBe(testSystem.id);
        expect(tier.name).toBe(`tier-${timestamp}`);
        expect(tier.description).toBe('Test Tier');
      });

      it('should prevent duplicate tier names per system', async () => {
        const timestamp = Date.now();
        const name = `duplicate-tier-${timestamp}`;
        await accessTierService.create({
          systemId: testSystem.id,
          name,
        });

        await expect(
          accessTierService.create({
            systemId: testSystem.id,
            name,
          }),
        ).rejects.toThrow();
      });

      it('should allow same tier name for different systems', async () => {
        const timestamp = Date.now() + Math.random() * 10000;
        const name = `admin-${timestamp}`;
        const system2 = await systemService.create({
          name: `System Tier 2 ${timestamp}`,
        });

        const tier1 = await accessTierService.create({
          systemId: testSystem.id,
          name,
        });
        const tier2 = await accessTierService.create({
          systemId: system2.id,
          name,
        });

        expect(tier1.name).toBe(name);
        expect(tier2.name).toBe(name);
        expect(tier1.systemId).not.toBe(tier2.systemId);
      });
    });

    describe('findBySystemId', () => {
      it('should find all tiers for a system', async () => {
        const timestamp = Date.now();
        await accessTierService.create({
          systemId: testSystem.id,
          name: `tier1-${timestamp}`,
        });
        await accessTierService.create({
          systemId: testSystem.id,
          name: `tier2-${timestamp}`,
        });

        const tiers = await accessTierService.findBySystemId(testSystem.id);

        expect(tiers.length).toBeGreaterThanOrEqual(2);
        tiers.forEach((tier: AccessTier) => {
          expect(tier.systemId).toBe(testSystem.id);
        });
      });
    });
  });

  describe('Controllers', () => {
    let systemsController: SystemsController;
    let systemInstancesController: SystemInstancesController;
    let accessTiersController: AccessTiersController;
    let testSystem: System;

    beforeAll(async () => {
      systemsController = module.get<SystemsController>(SystemsController);
      systemInstancesController = module.get<SystemInstancesController>(SystemInstancesController);
      accessTiersController = module.get<AccessTiersController>(AccessTiersController);
    });

    beforeEach(async () => {
      const timestamp = Date.now();
      testSystem = await systemService.create({
        name: `Controller Test System ${timestamp}`,
      });
    });

    describe('SystemsController', () => {
      it('POST /api/v1/systems should create system', async () => {
        const timestamp = Date.now();
        const result = await systemsController.create({
          name: `Controller System ${timestamp}`,
          description: 'Test',
        });

        expect(result.id).toBeDefined();
        expect(result.name).toBe(`Controller System ${timestamp}`);
      });

      it('GET /api/v1/systems should list systems', async () => {
        const result = await systemsController.findAll();

        expect(Array.isArray(result)).toBe(true);
      });

      it('GET /api/v1/systems/:id should get system', async () => {
        const result = await systemsController.findOne(testSystem.id);

        expect(result.id).toBe(testSystem.id);
      });
    });

    describe('SystemInstancesController', () => {
      it('GET /api/v1/systems/:id/instances should list instances', async () => {
        const timestamp = Date.now();
        await systemInstanceService.create({
          systemId: testSystem.id,
          name: `Controller Instance ${timestamp}`,
        });

        const result = await systemInstancesController.findBySystem(testSystem.id);

        expect(Array.isArray(result)).toBe(true);
      });

      it('POST /api/v1/systems/:id/instances should create instance', async () => {
        const timestamp = Date.now();
        const result = await systemInstancesController.create(testSystem.id, {
          name: `New Instance ${timestamp}`,
          region: 'EU',
        });

        expect(result.id).toBeDefined();
        expect(result.systemId).toBe(testSystem.id);
        expect(result.name).toBe(`New Instance ${timestamp}`);
      });
    });

    describe('AccessTiersController', () => {
      it('GET /api/v1/systems/:id/access-tiers should list tiers', async () => {
        const timestamp = Date.now();
        await accessTierService.create({
          systemId: testSystem.id,
          name: `tier-${timestamp}`,
        });

        const result = await accessTiersController.findBySystem(testSystem.id);

        expect(Array.isArray(result)).toBe(true);
      });

      it('POST /api/v1/systems/:id/access-tiers should create tier', async () => {
        const timestamp = Date.now();
        const result = await accessTiersController.create(testSystem.id, {
          name: `new-tier-${timestamp}`,
          description: 'New Tier',
        });

        expect(result.id).toBeDefined();
        expect(result.systemId).toBe(testSystem.id);
        expect(result.name).toBe(`new-tier-${timestamp}`);
      });
    });
  });
});
