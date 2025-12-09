import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../src/identity/entities/user.entity';
import { System } from '../../src/systems/entities/system.entity';
import { SystemInstance } from '../../src/systems/entities/system-instance.entity';
import { AccessTier } from '../../src/systems/entities/access-tier.entity';
import { SystemOwner } from '../../src/ownership/entities/system-owner.entity';
import {
  AccessGrant,
  AccessGrantStatus,
} from '../../src/access-control/entities/access-grant.entity';

describe('Entities and Relationships (Integration)', () => {
  let userRepository: Repository<User>;
  let systemRepository: Repository<System>;
  let systemInstanceRepository: Repository<SystemInstance>;
  let accessTierRepository: Repository<AccessTier>;
  let systemOwnerRepository: Repository<SystemOwner>;
  let accessGrantRepository: Repository<AccessGrant>;
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
          entities: [User, System, SystemInstance, AccessTier, SystemOwner, AccessGrant],
          synchronize: true, // Use synchronize for tests, migrations for production
          logging: false,
        }),
        TypeOrmModule.forFeature([
          User,
          System,
          SystemInstance,
          AccessTier,
          SystemOwner,
          AccessGrant,
        ]),
      ],
    }).compile();

    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    systemRepository = module.get<Repository<System>>(getRepositoryToken(System));
    systemInstanceRepository = module.get<Repository<SystemInstance>>(
      getRepositoryToken(SystemInstance),
    );
    accessTierRepository = module.get<Repository<AccessTier>>(getRepositoryToken(AccessTier));
    systemOwnerRepository = module.get<Repository<SystemOwner>>(getRepositoryToken(SystemOwner));
    accessGrantRepository = module.get<Repository<AccessGrant>>(getRepositoryToken(AccessGrant));
  });

  afterAll(async () => {
    // Clean up test data (only if tables exist)
    try {
      const accessGrants = await accessGrantRepository.find();
      if (accessGrants.length > 0) {
        await accessGrantRepository.remove(accessGrants);
      }
      const systemOwners = await systemOwnerRepository.find();
      if (systemOwners.length > 0) {
        await systemOwnerRepository.remove(systemOwners);
      }
      const accessTiers = await accessTierRepository.find();
      if (accessTiers.length > 0) {
        await accessTierRepository.remove(accessTiers);
      }
      const instances = await systemInstanceRepository.find();
      if (instances.length > 0) {
        await systemInstanceRepository.remove(instances);
      }
      const systems = await systemRepository.find();
      if (systems.length > 0) {
        await systemRepository.remove(systems);
      }
      const users = await userRepository.find();
      if (users.length > 0) {
        await userRepository.remove(users);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
    await module.close();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  describe('User Entity', () => {
    it('should create a user', async () => {
      const user = userRepository.create({
        email: 'test@example.com',
        name: 'Test User',
      });
      const saved = await userRepository.save(user);
      expect(saved.id).toBeDefined();
      expect(saved.email).toBe('test@example.com');
      expect(saved.name).toBe('Test User');
    });

    it('should enforce unique email constraint', async () => {
      const user1 = userRepository.create({
        email: 'duplicate@example.com',
        name: 'User 1',
      });
      await userRepository.save(user1);

      const user2 = userRepository.create({
        email: 'duplicate@example.com',
        name: 'User 2',
      });

      await expect(userRepository.save(user2)).rejects.toThrow();
    });

    it('should support manager relationship (self-referential)', async () => {
      const manager = userRepository.create({
        email: 'manager@example.com',
        name: 'Manager',
      });
      const savedManager = await userRepository.save(manager);

      const user = userRepository.create({
        email: 'employee@example.com',
        name: 'Employee',
        managerId: savedManager.id,
      });
      const savedUser = await userRepository.save(user);

      expect(savedUser.managerId).toBe(savedManager.id);
    });
  });

  describe('System Entity', () => {
    it('should create a system', async () => {
      const timestamp = Date.now();
      const system = systemRepository.create({
        name: `Acumatica-${timestamp}`,
        description: 'ERP System',
      });
      const saved = await systemRepository.save(system);
      expect(saved.id).toBeDefined();
      expect(saved.name).toBe(`Acumatica-${timestamp}`);
    });
  });

  describe('SystemInstance Entity', () => {
    it('should create a system instance', async () => {
      const timestamp = Date.now();
      const system = await systemRepository.save(systemRepository.create({ name: `Test System ${timestamp}` }));

      const instance = systemInstanceRepository.create({
        systemId: system.id,
        name: 'US Production',
        region: 'US',
        environment: 'production',
      });
      const saved = await systemInstanceRepository.save(instance);

      expect(saved.id).toBeDefined();
      expect(saved.systemId).toBe(system.id);
      expect(saved.name).toBe('US Production');
    });

    it('should enforce unique (systemId, name) constraint', async () => {
      const timestamp = Date.now();
      const system = await systemRepository.save(
        systemRepository.create({ name: `Test System 2 ${timestamp}` }),
      );

      const instance1 = systemInstanceRepository.create({
        systemId: system.id,
        name: 'Duplicate Name',
      });
      await systemInstanceRepository.save(instance1);

      const instance2 = systemInstanceRepository.create({
        systemId: system.id,
        name: 'Duplicate Name',
      });

      await expect(systemInstanceRepository.save(instance2)).rejects.toThrow();
    });
  });

  describe('AccessTier Entity', () => {
    it('should create an access tier', async () => {
      const timestamp = Date.now();
      const system = await systemRepository.save(
        systemRepository.create({ name: `Test System 3 ${timestamp}` }),
      );

      const tier = accessTierRepository.create({
        systemId: system.id,
        name: 'admin',
        description: 'Administrator access',
      });
      const saved = await accessTierRepository.save(tier);

      expect(saved.id).toBeDefined();
      expect(saved.systemId).toBe(system.id);
      expect(saved.name).toBe('admin');
    });

    it('should enforce unique (systemId, name) constraint', async () => {
      const timestamp = Date.now();
      const system = await systemRepository.save(
        systemRepository.create({ name: `Test System 4 ${timestamp}` }),
      );

      const tier1 = accessTierRepository.create({
        systemId: system.id,
        name: 'editor',
      });
      await accessTierRepository.save(tier1);

      const tier2 = accessTierRepository.create({
        systemId: system.id,
        name: 'editor',
      });

      await expect(accessTierRepository.save(tier2)).rejects.toThrow();
    });
  });

  describe('SystemOwner Entity', () => {
    it('should create a system owner relationship', async () => {
      const timestamp = Date.now();
      const user = await userRepository.save(
        userRepository.create({
          email: `owner-${timestamp}@example.com`,
          name: 'System Owner',
        }),
      );
      const system = await systemRepository.save(
        systemRepository.create({ name: `Test System 5 ${timestamp}` }),
      );

      const owner = systemOwnerRepository.create({
        userId: user.id,
        systemId: system.id,
      });
      const saved = await systemOwnerRepository.save(owner);

      expect(saved.id).toBeDefined();
      expect(saved.userId).toBe(user.id);
      expect(saved.systemId).toBe(system.id);
    });

    it('should enforce unique (userId, systemId) constraint', async () => {
      const timestamp = Date.now();
      const user = await userRepository.save(
        userRepository.create({
          email: `owner2-${timestamp}@example.com`,
          name: 'Owner 2',
        }),
      );
      const system = await systemRepository.save(
        systemRepository.create({ name: `Test System 6 ${timestamp}` }),
      );

      const owner1 = systemOwnerRepository.create({
        userId: user.id,
        systemId: system.id,
      });
      await systemOwnerRepository.save(owner1);

      const owner2 = systemOwnerRepository.create({
        userId: user.id,
        systemId: system.id,
      });

      await expect(systemOwnerRepository.save(owner2)).rejects.toThrow();
    });
  });

  describe('AccessGrant Entity', () => {
    it('should create an access grant', async () => {
      const timestamp = Date.now();
      const user = await userRepository.save(
        userRepository.create({
          email: `grantee-${timestamp}@example.com`,
          name: 'Grantee',
        }),
      );
      const system = await systemRepository.save(
        systemRepository.create({ name: `Test System 7 ${timestamp}` }),
      );
      const instance = await systemInstanceRepository.save(
        systemInstanceRepository.create({
          systemId: system.id,
          name: 'Instance',
        }),
      );
      const tier = await accessTierRepository.save(
        accessTierRepository.create({
          systemId: system.id,
          name: 'read-only',
        }),
      );
      const grantedBy = await userRepository.save(
        userRepository.create({
          email: `granter-${timestamp}@example.com`,
          name: 'Granter',
        }),
      );

      const grant = accessGrantRepository.create({
        userId: user.id,
        systemInstanceId: instance.id,
        accessTierId: tier.id,
        status: AccessGrantStatus.ACTIVE,
        grantedById: grantedBy.id,
      });
      const saved = await accessGrantRepository.save(grant);

      expect(saved.id).toBeDefined();
      expect(saved.userId).toBe(user.id);
      expect(saved.systemInstanceId).toBe(instance.id);
      expect(saved.accessTierId).toBe(tier.id);
      expect(saved.status).toBe(AccessGrantStatus.ACTIVE);
    });

    it('should enforce unique active grant constraint', async () => {
      const timestamp = Date.now();
      const user = await userRepository.save(
        userRepository.create({
          email: `grantee2-${timestamp}@example.com`,
          name: 'Grantee 2',
        }),
      );
      const system = await systemRepository.save(
        systemRepository.create({ name: `Test System 8 ${timestamp}` }),
      );
      const instance = await systemInstanceRepository.save(
        systemInstanceRepository.create({
          systemId: system.id,
          name: 'Instance 2',
        }),
      );
      const tier = await accessTierRepository.save(
        accessTierRepository.create({
          systemId: system.id,
          name: 'admin',
        }),
      );
      const grantedBy = await userRepository.save(
        userRepository.create({
          email: `granter2-${timestamp}@example.com`,
          name: 'Granter 2',
        }),
      );

      const grant1 = accessGrantRepository.create({
        userId: user.id,
        systemInstanceId: instance.id,
        accessTierId: tier.id,
        status: AccessGrantStatus.ACTIVE,
        grantedById: grantedBy.id,
      });
      await accessGrantRepository.save(grant1);

      const grant2 = accessGrantRepository.create({
        userId: user.id,
        systemInstanceId: instance.id,
        accessTierId: tier.id,
        status: AccessGrantStatus.ACTIVE,
        grantedById: grantedBy.id,
      });

      await expect(accessGrantRepository.save(grant2)).rejects.toThrow();
    });

    it('should allow multiple grants with different statuses', async () => {
      const timestamp = Date.now();
      const user = await userRepository.save(
        userRepository.create({
          email: `grantee3-${timestamp}@example.com`,
          name: 'Grantee 3',
        }),
      );
      const system = await systemRepository.save(
        systemRepository.create({ name: `Test System 9 ${timestamp}` }),
      );
      const instance = await systemInstanceRepository.save(
        systemInstanceRepository.create({
          systemId: system.id,
          name: 'Instance 3',
        }),
      );
      const tier = await accessTierRepository.save(
        accessTierRepository.create({
          systemId: system.id,
          name: 'editor',
        }),
      );
      const grantedBy = await userRepository.save(
        userRepository.create({
          email: `granter3-${timestamp}@example.com`,
          name: 'Granter 3',
        }),
      );

      const activeGrant = accessGrantRepository.create({
        userId: user.id,
        systemInstanceId: instance.id,
        accessTierId: tier.id,
        status: AccessGrantStatus.ACTIVE,
        grantedById: grantedBy.id,
      });
      await accessGrantRepository.save(activeGrant);

      const removedGrant = accessGrantRepository.create({
        userId: user.id,
        systemInstanceId: instance.id,
        accessTierId: tier.id,
        status: AccessGrantStatus.REMOVED,
        grantedById: grantedBy.id,
      });
      const saved = await accessGrantRepository.save(removedGrant);

      expect(saved.status).toBe(AccessGrantStatus.REMOVED);
    });
  });
});
