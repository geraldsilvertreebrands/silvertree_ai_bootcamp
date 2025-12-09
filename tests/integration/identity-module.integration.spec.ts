import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../src/identity/entities/user.entity';
import { UserService } from '../../src/identity/services/user.service';
import { UsersController } from '../../src/identity/controllers/users.controller';
import { AccessGrant } from '../../src/access-control/entities/access-grant.entity';
import { System } from '../../src/systems/entities/system.entity';
import { SystemInstance } from '../../src/systems/entities/system-instance.entity';
import { AccessTier } from '../../src/systems/entities/access-tier.entity';

describe('Identity Module (Integration)', () => {
  let userService: UserService;
  let userRepository: Repository<User>;
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
          entities: [User, AccessGrant, System, SystemInstance, AccessTier],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([User, AccessGrant]),
      ],
      controllers: [UsersController],
      providers: [UserService],
    }).compile();

    userService = module.get<UserService>(UserService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  // Note: No beforeEach cleanup - each test creates unique emails to avoid conflicts

  afterAll(async () => {
    try {
      // Clean up all users
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

  describe('UserService', () => {
    describe('create', () => {
      it('should create a user successfully', async () => {
        const timestamp = Date.now();
        const createUserDto = {
          email: `newuser-${timestamp}@example.com`,
          name: 'New User',
        };

        const user = await userService.create(createUserDto);

        expect(user.id).toBeDefined();
        expect(user.email).toBe(`newuser-${timestamp}@example.com`);
        expect(user.name).toBe('New User');
        expect(user.managerId).toBeNull();
      });

      it('should prevent duplicate email', async () => {
        const timestamp = Date.now();
        const createUserDto = {
          email: `duplicate-${timestamp}@example.com`,
          name: 'User 1',
        };

        await userService.create(createUserDto);

        await expect(userService.create(createUserDto)).rejects.toThrow();
      });
    });

    describe('findById', () => {
      it('should find user by ID', async () => {
        const timestamp = Date.now();
        const created = await userService.create({
          email: `findbyid-${timestamp}@example.com`,
          name: 'Find By ID',
        });

        const found = await userService.findById(created.id);

        expect(found).toBeDefined();
        expect(found).not.toBeNull();
        if (found) {
          expect(found.id).toBe(created.id);
          expect(found.email).toBe(`findbyid-${timestamp}@example.com`);
        }
      });

      it('should return null if user not found', async () => {
        const found = await userService.findById('00000000-0000-0000-0000-000000000000');

        expect(found).toBeNull();
      });
    });

    describe('findByEmail', () => {
      it('should find user by email', async () => {
        const timestamp = Date.now();
        const email = `findbyemail-${timestamp}@example.com`;
        const created = await userService.create({
          email,
          name: 'Find By Email',
        });

        const found = await userService.findByEmail(email);

        expect(found).toBeDefined();
        expect(found).not.toBeNull();
        if (found) {
          expect(found.id).toBe(created.id);
          expect(found.email).toBe(email);
        }
      });

      it('should return null if user not found', async () => {
        const found = await userService.findByEmail('nonexistent@example.com');

        expect(found).toBeNull();
      });
    });

    describe('update', () => {
      it('should update user', async () => {
        const timestamp = Date.now();
        const created = await userService.create({
          email: `update-${timestamp}@example.com`,
          name: 'Original Name',
        });

        const updated = await userService.update(created.id, {
          name: 'Updated Name',
        });

        expect(updated.name).toBe('Updated Name');
        expect(updated.email).toBe(`update-${timestamp}@example.com`);
      });

      it('should throw error if user not found', async () => {
        await expect(
          userService.update('00000000-0000-0000-0000-000000000000', {
            name: 'Test',
          }),
        ).rejects.toThrow();
      });
    });

    describe('findAll', () => {
      it('should return paginated list of users', async () => {
        const timestamp = Date.now();
        // Create multiple users
        await userService.create({
          email: `user1-${timestamp}@example.com`,
          name: 'User 1',
        });
        await userService.create({
          email: `user2-${timestamp}@example.com`,
          name: 'User 2',
        });
        await userService.create({
          email: `user3-${timestamp}@example.com`,
          name: 'User 3',
        });

        const result = await userService.findAll({ page: 1, limit: 2 });

        expect(result.data).toHaveLength(2);
        expect(result.total).toBeGreaterThanOrEqual(3);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(2);
      });
    });

    describe('assignManager', () => {
      it('should assign manager to user', async () => {
        const timestamp = Date.now() + Math.random() * 10000;
        const manager = await userService.create({
          email: `manager-assign-${timestamp}@example.com`,
          name: 'Manager',
        });
        const user = await userService.create({
          email: `employee-assign-${timestamp}@example.com`,
          name: 'Employee',
        });

        const updated = await userService.assignManager(user.id, manager.id);

        expect(updated.managerId).toBe(manager.id);
      });

      it('should prevent self-assignment', async () => {
        const user = await userService.create({
          email: 'self@example.com',
          name: 'Self User',
        });

        await expect(userService.assignManager(user.id, user.id)).rejects.toThrow();
      });

      it('should prevent circular references (user cannot be manager of their manager)', async () => {
        const manager = await userService.create({
          email: 'manager2@example.com',
          name: 'Manager 2',
        });
        const user = await userService.create({
          email: 'employee2@example.com',
          name: 'Employee 2',
        });

        // Assign manager to user
        await userService.assignManager(user.id, manager.id);

        // Try to assign user as manager of manager (circular)
        await expect(userService.assignManager(manager.id, user.id)).rejects.toThrow();
      });
    });
  });

  describe('UsersController', () => {
    let controller: UsersController;

    beforeAll(() => {
      controller = module.get<UsersController>(UsersController);
    });

    describe('POST /api/v1/users', () => {
      it('should create user via controller', async () => {
        const timestamp = Date.now();
        const createUserDto = {
          email: `controller-${timestamp}@example.com`,
          name: 'Controller User',
        };

        const result = await controller.create(createUserDto);

        expect(result.id).toBeDefined();
        expect(result.email).toBe(`controller-${timestamp}@example.com`);
      });
    });

    describe('GET /api/v1/users', () => {
      it('should list users via controller', async () => {
        const result = await controller.findAll({ page: 1, limit: 10 });

        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      });
    });

    describe('GET /api/v1/users/:id', () => {
      it('should get user by ID via controller', async () => {
        const timestamp = Date.now();
        const created = await userService.create({
          email: `getbyid-ctrl2-${timestamp}@example.com`,
          name: 'Get By ID',
        });

        const result = await controller.findOne(created.id);

        expect(result.id).toBe(created.id);
        expect(result.email).toBe(`getbyid-ctrl2-${timestamp}@example.com`);
      });

      it('should return 404 if user not found', async () => {
        await expect(controller.findOne('00000000-0000-0000-0000-000000000000')).rejects.toThrow();
      });
    });

    describe('PATCH /api/v1/users/:id', () => {
      it('should update user via controller', async () => {
        const timestamp = Date.now();
        const created = await userService.create({
          email: `updatecontroller-${timestamp}@example.com`,
          name: 'Original',
        });

        const result = await controller.update(created.id, {
          name: 'Updated',
        });

        expect(result.name).toBe('Updated');
      });
    });

    describe('PATCH /api/v1/users/:id/manager', () => {
      it('should assign manager via controller', async () => {
        const timestamp = Date.now();
        const manager = await userService.create({
          email: `managercontroller-${timestamp}@example.com`,
          name: 'Manager',
        });
        const user = await userService.create({
          email: `employeecontroller-${timestamp}@example.com`,
          name: 'Employee',
        });

        const result = await controller.assignManager(user.id, {
          managerId: manager.id,
        });

        expect(result.managerId).toBe(manager.id);
      });
    });
  });
});
