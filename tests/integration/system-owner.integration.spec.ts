import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../src/identity/entities/user.entity';
import { System } from '../../src/systems/entities/system.entity';
import { SystemInstance } from '../../src/systems/entities/system-instance.entity';
import { AccessTier } from '../../src/systems/entities/access-tier.entity';
import { SystemOwner } from '../../src/ownership/entities/system-owner.entity';
import { AccessGrant } from '../../src/access-control/entities/access-grant.entity';
import { SystemOwnerService } from '../../src/ownership/services/system-owner.service';
import {
  SystemOwnersController,
  UserOwnedSystemsController,
} from '../../src/ownership/controllers/system-owners.controller';

describe('System Owner Management (Integration)', () => {
  let systemOwnerService: SystemOwnerService;
  let systemOwnersController: SystemOwnersController;
  let userOwnedSystemsController: UserOwnedSystemsController;
  let userRepository: Repository<User>;
  let systemRepository: Repository<System>;
  let systemOwnerRepository: Repository<SystemOwner>;
  let module: TestingModule;

  let testUser1: User;
  let testUser2: User;
  let testSystem1: System;
  let testSystem2: System;

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
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([User, System, SystemOwner]),
      ],
      controllers: [SystemOwnersController, UserOwnedSystemsController],
      providers: [SystemOwnerService],
    }).compile();

    systemOwnerService = module.get<SystemOwnerService>(SystemOwnerService);
    systemOwnersController = module.get<SystemOwnersController>(SystemOwnersController);
    userOwnedSystemsController = module.get<UserOwnedSystemsController>(
      UserOwnedSystemsController,
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    systemRepository = module.get<Repository<System>>(getRepositoryToken(System));
    systemOwnerRepository = module.get<Repository<SystemOwner>>(getRepositoryToken(SystemOwner));

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

    testSystem1 = await systemRepository.save({
      name: `Test System 1 ${timestamp}`,
      description: 'Test',
    });
    testSystem2 = await systemRepository.save({
      name: `Test System 2 ${timestamp}`,
      description: 'Test',
    });
  });

  afterAll(async () => {
    try {
      await systemOwnerRepository.clear();
      await systemRepository.clear();
      await userRepository.clear();
    } catch (error) {
      // Ignore cleanup errors
    }
    await module.close();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  beforeEach(async () => {
    // Clean up ownership before each test
    await systemOwnerRepository.clear();

    // Verify test data exists
    const user1Exists = await userRepository.findOne({ where: { id: testUser1.id } });
    const system1Exists = await systemRepository.findOne({ where: { id: testSystem1.id } });

    if (!user1Exists || !system1Exists) {
      const timestamp = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      testUser1 = await userRepository.save({
        email: `user1-${timestamp}@example.com`,
        name: 'Test User 1',
      });
      testUser2 = await userRepository.save({
        email: `user2-${timestamp}@example.com`,
        name: 'Test User 2',
      });
      testSystem1 = await systemRepository.save({
        name: `Test System 1 ${timestamp}`,
        description: 'Test',
      });
      testSystem2 = await systemRepository.save({
        name: `Test System 2 ${timestamp}`,
        description: 'Test',
      });
    }
  });

  describe('SystemOwnerService', () => {
    describe('assign', () => {
      it('should assign user as system owner', async () => {
        const owner = await systemOwnerService.assign(testSystem1.id, {
          userId: testUser1.id,
        });

        expect(owner.id).toBeDefined();
        expect(owner.userId).toBe(testUser1.id);
        expect(owner.systemId).toBe(testSystem1.id);
        expect(owner.user).toBeDefined();
        expect(owner.system).toBeDefined();
      });

      it('should throw NotFoundException when system does not exist', async () => {
        const fakeSystemId = '00000000-0000-0000-0000-000000000000';

        await expect(
          systemOwnerService.assign(fakeSystemId, { userId: testUser1.id }),
        ).rejects.toThrow('System with ID 00000000-0000-0000-0000-000000000000 not found');
      });

      it('should throw NotFoundException when user does not exist', async () => {
        const fakeUserId = '00000000-0000-0000-0000-000000000000';

        await expect(
          systemOwnerService.assign(testSystem1.id, { userId: fakeUserId }),
        ).rejects.toThrow('User with ID 00000000-0000-0000-0000-000000000000 not found');
      });

      it('should throw ConflictException for duplicate ownership', async () => {
        // Assign once
        await systemOwnerService.assign(testSystem1.id, { userId: testUser1.id });

        // Try to assign again
        await expect(
          systemOwnerService.assign(testSystem1.id, { userId: testUser1.id }),
        ).rejects.toThrow('is already an owner');
      });

      it('should allow same user to own multiple systems', async () => {
        const owner1 = await systemOwnerService.assign(testSystem1.id, {
          userId: testUser1.id,
        });
        const owner2 = await systemOwnerService.assign(testSystem2.id, {
          userId: testUser1.id,
        });

        expect(owner1.systemId).toBe(testSystem1.id);
        expect(owner2.systemId).toBe(testSystem2.id);
        expect(owner1.userId).toBe(owner2.userId);
      });

      it('should allow multiple users to own same system', async () => {
        const owner1 = await systemOwnerService.assign(testSystem1.id, {
          userId: testUser1.id,
        });
        const owner2 = await systemOwnerService.assign(testSystem1.id, {
          userId: testUser2.id,
        });

        expect(owner1.systemId).toBe(owner2.systemId);
        expect(owner1.userId).toBe(testUser1.id);
        expect(owner2.userId).toBe(testUser2.id);
      });
    });

    describe('findBySystem', () => {
      it('should return all owners for a system', async () => {
        await systemOwnerService.assign(testSystem1.id, { userId: testUser1.id });
        await systemOwnerService.assign(testSystem1.id, { userId: testUser2.id });

        const owners = await systemOwnerService.findBySystem(testSystem1.id);

        expect(owners.length).toBe(2);
        expect(owners[0].user).toBeDefined();
        expect(owners.every((o) => o.systemId === testSystem1.id)).toBe(true);
      });

      it('should return empty array if no owners', async () => {
        const owners = await systemOwnerService.findBySystem(testSystem1.id);
        expect(owners).toEqual([]);
      });

      it('should throw NotFoundException when system does not exist', async () => {
        const fakeSystemId = '00000000-0000-0000-0000-000000000000';

        await expect(systemOwnerService.findBySystem(fakeSystemId)).rejects.toThrow(
          'System with ID 00000000-0000-0000-0000-000000000000 not found',
        );
      });
    });

    describe('findByUser', () => {
      it('should return all systems owned by user', async () => {
        await systemOwnerService.assign(testSystem1.id, { userId: testUser1.id });
        await systemOwnerService.assign(testSystem2.id, { userId: testUser1.id });

        const ownerships = await systemOwnerService.findByUser(testUser1.id);

        expect(ownerships.length).toBe(2);
        expect(ownerships[0].system).toBeDefined();
        expect(ownerships.every((o) => o.userId === testUser1.id)).toBe(true);
      });

      it('should return empty array if user owns no systems', async () => {
        const ownerships = await systemOwnerService.findByUser(testUser1.id);
        expect(ownerships).toEqual([]);
      });

      it('should throw NotFoundException when user does not exist', async () => {
        const fakeUserId = '00000000-0000-0000-0000-000000000000';

        await expect(systemOwnerService.findByUser(fakeUserId)).rejects.toThrow(
          'User with ID 00000000-0000-0000-0000-000000000000 not found',
        );
      });
    });

    describe('remove', () => {
      it('should remove system owner', async () => {
        await systemOwnerService.assign(testSystem1.id, { userId: testUser1.id });

        await systemOwnerService.remove(testSystem1.id, testUser1.id);

        const owners = await systemOwnerService.findBySystem(testSystem1.id);
        expect(owners.length).toBe(0);
      });

      it('should throw NotFoundException when system does not exist', async () => {
        const fakeSystemId = '00000000-0000-0000-0000-000000000000';

        await expect(
          systemOwnerService.remove(fakeSystemId, testUser1.id),
        ).rejects.toThrow('System with ID');
      });

      it('should throw NotFoundException when user does not exist', async () => {
        const fakeUserId = '00000000-0000-0000-0000-000000000000';

        await expect(
          systemOwnerService.remove(testSystem1.id, fakeUserId),
        ).rejects.toThrow('User with ID');
      });

      it('should throw NotFoundException when ownership does not exist', async () => {
        await expect(
          systemOwnerService.remove(testSystem1.id, testUser1.id),
        ).rejects.toThrow('is not an owner');
      });
    });
  });

  describe('SystemOwnersController', () => {
    it('should assign owner through POST endpoint', async () => {
      const result = await systemOwnersController.assign(testSystem1.id, {
        userId: testUser1.id,
      });

      expect(result.userId).toBe(testUser1.id);
      expect(result.systemId).toBe(testSystem1.id);
      expect(result.user).toBeDefined();
      expect(result.system).toBeDefined();
    });

    it('should list owners through GET endpoint', async () => {
      await systemOwnersController.assign(testSystem1.id, { userId: testUser1.id });
      await systemOwnersController.assign(testSystem1.id, { userId: testUser2.id });

      const owners = await systemOwnersController.findBySystem(testSystem1.id);

      expect(owners.length).toBe(2);
    });

    it('should remove owner through DELETE endpoint', async () => {
      await systemOwnersController.assign(testSystem1.id, { userId: testUser1.id });

      const result = await systemOwnersController.remove(testSystem1.id, testUser1.id);

      expect(result.message).toBe('System owner removed successfully');
    });
  });

  describe('UserOwnedSystemsController', () => {
    it('should list systems owned by user through GET endpoint', async () => {
      await systemOwnersController.assign(testSystem1.id, { userId: testUser1.id });
      await systemOwnersController.assign(testSystem2.id, { userId: testUser1.id });

      const ownerships = await userOwnedSystemsController.findByUser(testUser1.id);

      expect(ownerships.length).toBe(2);
      expect(ownerships[0].system).toBeDefined();
    });
  });
});

