import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../src/identity/entities/user.entity';
import { IdentityModule } from '../../src/identity/identity.module';

describe('Users API (Integration)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let userRepository: Repository<User>;

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
          entities: [User],
          synchronize: true,
          logging: false,
        }),
        IdentityModule,
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();

    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  // Note: Each test uses unique emails to avoid conflicts

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
    await app.close();
    await module.close();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  describe('POST /api/v1/users', () => {
    it('should create user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({
          email: 'apitest@example.com',
          name: 'API Test User',
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.email).toBe('apitest@example.com');
      expect(response.body.name).toBe('API Test User');
    });

    it('should return 400 for invalid email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({
          email: 'invalid-email',
          name: 'Test',
        })
        .expect(400);
    });

    it('should return 400 for missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({
          email: 'missingname@example.com',
        })
        .expect(400);
    });

    it('should return 409 for duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({
          email: 'duplicateapi@example.com',
          name: 'User 1',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({
          email: 'duplicateapi@example.com',
          name: 'User 2',
        })
        .expect(409);
    });
  });

  describe('GET /api/v1/users', () => {
    it('should list users with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.total).toBeDefined();
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('should get user by ID', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({
          email: 'getbyidapi@example.com',
          name: 'Get By ID API',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/users/${createResponse.body.id}`)
        .expect(200);

      expect(response.body.id).toBe(createResponse.body.id);
      expect(response.body.email).toBe('getbyidapi@example.com');
    });

    it('should return 404 for non-existent user', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('PATCH /api/v1/users/:id', () => {
    it('should update user', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({
          email: 'updateapi@example.com',
          name: 'Original Name',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/users/${createResponse.body.id}`)
        .send({
          name: 'Updated Name',
        })
        .expect(200);

      expect(response.body.name).toBe('Updated Name');
      expect(response.body.email).toBe('updateapi@example.com');
    });
  });

  describe('PATCH /api/v1/users/:id/manager', () => {
    it('should assign manager', async () => {
      const managerResponse = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({
          email: 'managerapi@example.com',
          name: 'Manager',
        })
        .expect(201);

      const userResponse = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({
          email: 'employeeapi@example.com',
          name: 'Employee',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/users/${userResponse.body.id}/manager`)
        .send({
          managerId: managerResponse.body.id,
        })
        .expect(200);

      expect(response.body.managerId).toBe(managerResponse.body.id);
    });

    it('should return 400 for self-assignment', async () => {
      const userResponse = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({
          email: 'selfapi@example.com',
          name: 'Self User',
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/users/${userResponse.body.id}/manager`)
        .send({
          managerId: userResponse.body.id,
        })
        .expect(400);
    });
  });
});
