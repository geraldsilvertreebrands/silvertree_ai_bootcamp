import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessControlModule } from '../../src/access-control/access-control.module';
import { IdentityModule } from '../../src/identity/identity.module';
import { SystemsModule } from '../../src/systems/systems.module';
import { User } from '../../src/identity/entities/user.entity';
import { System } from '../../src/systems/entities/system.entity';
import { SystemInstance } from '../../src/systems/entities/system-instance.entity';
import { AccessTier } from '../../src/systems/entities/access-tier.entity';
import {
  AccessGrant,
  AccessGrantStatus,
} from '../../src/access-control/entities/access-grant.entity';

describe('Bulk Access Grants (Integration)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let systemRepository: Repository<System>;
  let instanceRepository: Repository<SystemInstance>;
  let tierRepository: Repository<AccessTier>;
  let grantRepository: Repository<AccessGrant>;
  let testUser1: User;
  let testUser2: User;
  let testSystem: System;
  let testInstance: SystemInstance;
  let testTier: AccessTier;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
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
        IdentityModule,
        SystemsModule,
        AccessControlModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    systemRepository = moduleFixture.get<Repository<System>>(getRepositoryToken(System));
    instanceRepository = moduleFixture.get<Repository<SystemInstance>>(getRepositoryToken(SystemInstance));
    tierRepository = moduleFixture.get<Repository<AccessTier>>(getRepositoryToken(AccessTier));
    grantRepository = moduleFixture.get<Repository<AccessGrant>>(getRepositoryToken(AccessGrant));

    // Create test data
    const timestamp = Date.now();
    testUser1 = await userRepository.save(
      userRepository.create({
        email: `bulk-test-user1-${timestamp}@example.com`,
        name: 'Bulk Test User 1',
      }),
    );

    testUser2 = await userRepository.save(
      userRepository.create({
        email: `bulk-test-user2-${timestamp}@example.com`,
        name: 'Bulk Test User 2',
      }),
    );

    testSystem = await systemRepository.save(
      systemRepository.create({
        name: `Bulk Test System ${timestamp}`,
        description: 'Test system for bulk grants',
      }),
    );

    testInstance = await instanceRepository.save(
      instanceRepository.create({
        systemId: testSystem.id,
        name: 'Test Instance',
        region: 'US',
      }),
    );

    testTier = await tierRepository.save(
      tierRepository.create({
        systemId: testSystem.id,
        name: 'Admin',
        description: 'Admin access',
      }),
    );
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // Clean up grants before each test to avoid duplicates
    await grantRepository.createQueryBuilder().delete().execute();
  });

  describe('POST /api/v1/access-grants/bulk', () => {
    it('should create multiple grants successfully', async () => {
      const bulkDto = {
        grants: [
          {
            userId: testUser1.id,
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
          {
            userId: testUser2.id,
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/access-grants/bulk')
        .send(bulkDto)
        .expect(200);

      expect(response.body.success).toBe(2);
      expect(response.body.failed).toBe(0);
      expect(response.body.skipped).toBe(0);
      expect(response.body.results).toHaveLength(2);
      expect(response.body.results[0].success).toBe(true);
      expect(response.body.results[1].success).toBe(true);
    });

    it('should handle partial failures gracefully', async () => {
      const bulkDto = {
        grants: [
          {
            userId: testUser1.id,
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
          {
            userId: '00000000-0000-0000-0000-000000000000', // Invalid user ID
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/access-grants/bulk')
        .send(bulkDto)
        .expect(200);

      expect(response.body.success).toBe(1);
      expect(response.body.failed).toBe(1);
      expect(response.body.results).toHaveLength(2);
      expect(response.body.results[0].success).toBe(true);
      expect(response.body.results[1].success).toBe(false);
      expect(response.body.results[1].error).toBeDefined();
    });

    it('should skip duplicate active grants', async () => {
      // Create a grant first directly via repository to avoid auth issues
      await grantRepository.save(
        grantRepository.create({
          userId: testUser1.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
          status: AccessGrantStatus.ACTIVE,
          grantedAt: new Date(),
        }),
      );

      // Try to create duplicate via bulk
      const bulkDto = {
        grants: [
          {
            userId: testUser1.id,
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/access-grants/bulk')
        .send(bulkDto)
        .expect(200);

      expect(response.body.success).toBe(0);
      expect(response.body.skipped).toBe(1);
      expect(response.body.results[0].skipped).toBe(true);
      expect(response.body.results[0].error).toContain('Duplicate');
    });

    it('should validate maximum array size', async () => {
      const grants = Array(101).fill(null).map(() => ({
        userId: testUser1.id,
        systemInstanceId: testInstance.id,
        accessTierId: testTier.id,
      }));

      const bulkDto = { grants };

      await request(app.getHttpServer())
        .post('/api/v1/access-grants/bulk')
        .send(bulkDto)
        .expect(400);
    });

    it('should validate minimum array size', async () => {
      const bulkDto = { grants: [] };

      await request(app.getHttpServer())
        .post('/api/v1/access-grants/bulk')
        .send(bulkDto)
        .expect(400);
    });

    it('should return detailed results for each grant', async () => {
      const bulkDto = {
        grants: [
          {
            userId: testUser1.id,
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
          {
            userId: 'invalid-uuid',
            systemInstanceId: testInstance.id,
            accessTierId: testTier.id,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/access-grants/bulk')
        .send(bulkDto)
        .expect(200);

      expect(response.body.results).toHaveLength(2);
      expect(response.body.results[0].row).toBe(1);
      expect(response.body.results[1].row).toBe(2);
      expect(response.body.results[0].success).toBe(true);
      expect(response.body.results[1].success).toBe(false);
    });
  });
});
