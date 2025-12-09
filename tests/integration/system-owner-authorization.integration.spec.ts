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

describe('System Owner Authorization (Integration)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let systemRepository: Repository<System>;
  let instanceRepository: Repository<SystemInstance>;
  let tierRepository: Repository<AccessTier>;
  let grantRepository: Repository<AccessGrant>;
  let ownerRepository: Repository<SystemOwner>;
  let ownerUser: User;
  let nonOwnerUser: User;
  let testSystem: System;
  let testInstance: SystemInstance;
  let testTier: AccessTier;
  let ownerToken: string;
  let nonOwnerToken: string;

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
        AccessControlModule,
        AuthModule,
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
    ownerRepository = moduleFixture.get<Repository<SystemOwner>>(getRepositoryToken(SystemOwner));

    // Create test users
    const timestamp = Date.now();
    ownerUser = await userRepository.save(
      userRepository.create({
        email: `owner-${timestamp}@test.com`,
        name: 'System Owner',
      }),
    );

    nonOwnerUser = await userRepository.save(
      userRepository.create({
        email: `nonowner-${timestamp}@test.com`,
        name: 'Non Owner',
      }),
    );

    // Create system
    testSystem = await systemRepository.save(
      systemRepository.create({
        name: `Test System ${timestamp}`,
        description: 'Test system',
      }),
    );

    // Create instance
    testInstance = await instanceRepository.save(
      instanceRepository.create({
        systemId: testSystem.id,
        name: 'Test Instance',
        region: 'US',
      }),
    );

    // Create tier
    testTier = await tierRepository.save(
      tierRepository.create({
        systemId: testSystem.id,
        name: 'Admin',
        description: 'Admin access',
      }),
    );

    // Assign owner
    await ownerRepository.save(
      ownerRepository.create({
        userId: ownerUser.id,
        systemId: testSystem.id,
      }),
    );

    // Get tokens
    ownerToken = Buffer.from(ownerUser.email).toString('base64');
    nonOwnerToken = Buffer.from(nonOwnerUser.email).toString('base64');
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /api/v1/access-grants', () => {
    afterEach(async () => {
      // Clean up grants after each test - delete all grants for test users
      await grantRepository
        .createQueryBuilder()
        .delete()
        .where('userId IN (:...userIds)', { userIds: [ownerUser.id, nonOwnerUser.id] })
        .execute();
    });

    it('should allow system owner to create grant', async () => {
      // Use a different user to avoid duplicate grant conflict
      const testUser = await userRepository.save(
        userRepository.create({
          email: `testuser1-${Date.now()}@test.com`,
          name: 'Test User 1',
        }),
      );

      const grantDto = {
        userId: testUser.id,
        systemInstanceId: testInstance.id,
        accessTierId: testTier.id,
      };

      await request(app.getHttpServer())
        .post('/api/v1/access-grants')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(grantDto)
        .expect(201);
    });

    it('should return 403 if user is not system owner', async () => {
      const grantDto = {
        userId: nonOwnerUser.id,
        systemInstanceId: testInstance.id,
        accessTierId: testTier.id,
      };

      await request(app.getHttpServer())
        .post('/api/v1/access-grants')
        .set('Authorization', `Bearer ${nonOwnerToken}`)
        .send(grantDto)
        .expect(403);
    });

    it('should set grantedById automatically from authenticated user', async () => {
      // Use a different user to avoid duplicate grant conflict
      const testUser = await userRepository.save(
        userRepository.create({
          email: `testuser-${Date.now()}@test.com`,
          name: 'Test User',
        }),
      );

      const grantDto = {
        userId: testUser.id,
        systemInstanceId: testInstance.id,
        accessTierId: testTier.id,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/access-grants')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(grantDto)
        .expect(201);

      expect(response.body.grantedById).toBe(ownerUser.id);
    });
  });

  describe('PATCH /api/v1/access-grants/:id/status', () => {
    let testGrant: AccessGrant;

    beforeEach(async () => {
      // Clean up any existing grants for test users
      await grantRepository
        .createQueryBuilder()
        .delete()
        .where('userId IN (:...userIds)', { userIds: [ownerUser.id, nonOwnerUser.id] })
        .execute();
      
      // Create a grant owned by ownerUser
      testGrant = await grantRepository.save(
        grantRepository.create({
          userId: ownerUser.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
          status: AccessGrantStatus.ACTIVE,
          grantedById: ownerUser.id,
          grantedAt: new Date(),
        }),
      );
    });

    it('should allow system owner to update grant status', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/access-grants/${testGrant.id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'removed' })
        .expect(200);
    });

    it('should return 403 if user is not system owner', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/access-grants/${testGrant.id}/status`)
        .set('Authorization', `Bearer ${nonOwnerToken}`)
        .send({ status: 'removed' })
        .expect(403);
    });

    it('should allow system owner to mark grant to_remove', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/access-grants/${testGrant.id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'to_remove' })
        .expect(200);
    });
  });
});

