import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessControlModule } from '../../src/access-control/access-control.module';
import { IdentityModule } from '../../src/identity/identity.module';
import { SystemsModule } from '../../src/systems/systems.module';
import { OwnershipModule } from '../../src/ownership/ownership.module';
import { AuthModule } from '../../src/auth/auth.module';
import { User } from '../../src/identity/entities/user.entity';
import { System } from '../../src/systems/entities/system.entity';
import { SystemInstance } from '../../src/systems/entities/system-instance.entity';
import { AccessTier } from '../../src/systems/entities/access-tier.entity';
import {
  AccessGrant,
  AccessGrantStatus,
} from '../../src/access-control/entities/access-grant.entity';
import { SystemOwner } from '../../src/ownership/entities/system-owner.entity';

describe('CSV Bulk Upload (Integration)', () => {
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
          entities: [User, System, SystemInstance, AccessTier, AccessGrant, SystemOwner],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([User, System, SystemInstance, AccessTier, AccessGrant, SystemOwner]),
        IdentityModule,
        SystemsModule,
        OwnershipModule,
        AuthModule,
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
        email: `csv-test-user1-${timestamp}@example.com`,
        name: 'CSV Test User 1',
      }),
    );

    testUser2 = await userRepository.save(
      userRepository.create({
        email: `csv-test-user2-${timestamp}@example.com`,
        name: 'CSV Test User 2',
      }),
    );

    testSystem = await systemRepository.save(
      systemRepository.create({
        name: `CSV Test System ${timestamp}`,
        description: 'Test system for CSV upload',
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
    // Clean up grants before each test
    await grantRepository.createQueryBuilder().delete().execute();
  });

  describe('POST /api/v1/access-grants/bulk/csv', () => {
    it('should upload CSV and create grants successfully', async () => {
      const csvContent = `userEmail,systemName,instanceName,tierName,status
${testUser1.email},${testSystem.name},${testInstance.name},${testTier.name},active
${testUser2.email},${testSystem.name},${testInstance.name},${testTier.name},active`;

      const response = await request(app.getHttpServer())
        .post('/api/v1/access-grants/bulk/csv')
        .attach('file', Buffer.from(csvContent), 'grants.csv')
        .expect(200);

      expect(response.body.success).toBe(2);
      expect(response.body.failed).toBe(0);
      expect(response.body.skipped).toBe(0);
      expect(response.body.results).toHaveLength(2);
      expect(response.body.results[0].success).toBe(true);
      expect(response.body.results[1].success).toBe(true);
    });

    it('should handle invalid CSV format', async () => {
      const csvContent = 'invalid,csv,content\nrow1,row2';

      await request(app.getHttpServer())
        .post('/api/v1/access-grants/bulk/csv')
        .attach('file', Buffer.from(csvContent), 'invalid.csv')
        .expect(400);
    });

    it('should handle missing required columns', async () => {
      const csvContent = `userEmail,systemName
${testUser1.email},${testSystem.name}`;

      await request(app.getHttpServer())
        .post('/api/v1/access-grants/bulk/csv')
        .attach('file', Buffer.from(csvContent), 'missing-columns.csv')
        .expect(400);
    });

    it('should create user if missing and proceed', async () => {
      const csvContent = `userEmail,systemName,instanceName,tierName
nonexistent@example.com,${testSystem.name},${testInstance.name},${testTier.name}`;

      const response = await request(app.getHttpServer())
        .post('/api/v1/access-grants/bulk/csv')
        .attach('file', Buffer.from(csvContent), 'invalid-user.csv')
        .expect(200);

      expect(response.body.success).toBe(1);
      expect(response.body.failed).toBe(0);
      expect(response.body.results[0].success).toBe(true);

      const createdUser = await userRepository.findOne({
        where: { email: 'nonexistent@example.com' },
      });
      expect(createdUser).toBeDefined();
    });

    it('should validate system exists', async () => {
      const csvContent = `userEmail,systemName,instanceName,tierName
${testUser1.email},Nonexistent System,${testInstance.name},${testTier.name}`;

      const response = await request(app.getHttpServer())
        .post('/api/v1/access-grants/bulk/csv')
        .attach('file', Buffer.from(csvContent), 'invalid-system.csv')
        .expect(200);

      expect(response.body.success).toBe(0);
      expect(response.body.failed).toBe(1);
      expect(response.body.results[0].error).toContain('System not found');
    });

    it('should skip duplicate active grants', async () => {
      // Create a grant first
      await grantRepository.save(
        grantRepository.create({
          userId: testUser1.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
          status: AccessGrantStatus.ACTIVE,
          grantedAt: new Date(),
        }),
      );

      const csvContent = `userEmail,systemName,instanceName,tierName
${testUser1.email},${testSystem.name},${testInstance.name},${testTier.name}`;

      const response = await request(app.getHttpServer())
        .post('/api/v1/access-grants/bulk/csv')
        .attach('file', Buffer.from(csvContent), 'duplicate.csv')
        .expect(200);

      expect(response.body.success).toBe(0);
      expect(response.body.skipped).toBe(1);
      expect(response.body.results[0].skipped).toBe(true);
      expect(response.body.results[0].error).toContain('Duplicate');
    });

    it('should handle partial failures gracefully', async () => {
      const csvContent = `userEmail,systemName,instanceName,tierName
${testUser1.email},${testSystem.name},${testInstance.name},${testTier.name}
nonexistent@example.com,BadSystemName,${testInstance.name},${testTier.name}
${testUser2.email},${testSystem.name},${testInstance.name},${testTier.name}`;

      const response = await request(app.getHttpServer())
        .post('/api/v1/access-grants/bulk/csv')
        .attach('file', Buffer.from(csvContent), 'partial-failures.csv')
        .expect(200);

      expect(response.body.success).toBe(2);
      expect(response.body.failed).toBe(1);
      expect(response.body.results).toHaveLength(3);
      expect(response.body.results.some((r: any) => r.success === false)).toBe(true);
    });

    it('should reject files larger than 5MB', async () => {
      const largeContent = 'userEmail,systemName,instanceName,tierName\n' + 'test@example.com,Test,Test,Test\n'.repeat(1000000);

      await request(app.getHttpServer())
        .post('/api/v1/access-grants/bulk/csv')
        .attach('file', Buffer.from(largeContent), 'large.csv')
        .expect(400);
    });

    it('should reject files with more than 1000 rows', async () => {
      const rows = Array(1001)
        .fill(null)
        .map((_, i) => `${testUser1.email},${testSystem.name},${testInstance.name},${testTier.name}`)
        .join('\n');
      const csvContent = `userEmail,systemName,instanceName,tierName\n${rows}`;

      await request(app.getHttpServer())
        .post('/api/v1/access-grants/bulk/csv')
        .attach('file', Buffer.from(csvContent), 'too-many-rows.csv')
        .expect(400);
    });

    it('should handle case-insensitive column headers', async () => {
      const csvContent = `User Email,System Name,Instance Name,Tier Name
${testUser1.email},${testSystem.name},${testInstance.name},${testTier.name}`;

      const response = await request(app.getHttpServer())
        .post('/api/v1/access-grants/bulk/csv')
        .attach('file', Buffer.from(csvContent), 'case-insensitive.csv')
        .expect(200);

      expect(response.body.success).toBe(1);
    });
  });

  describe('GET /api/v1/access-grants/bulk/csv/template', () => {
    it('should download CSV template', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/access-grants/bulk/csv/template')
        .expect(200)
        .expect('Content-Type', /text\/csv/)
        .expect('Content-Disposition', /attachment; filename="access-grants-template.csv"/);

      const csvContent = response.text;
      expect(csvContent).toContain('userEmail');
      expect(csvContent).toContain('systemName');
      expect(csvContent).toContain('instanceName');
      expect(csvContent).toContain('tierName');
      expect(csvContent).toContain('status');
      expect(csvContent).toContain('grantedAt');
    });
  });
});

