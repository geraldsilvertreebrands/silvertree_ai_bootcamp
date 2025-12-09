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
import {
  AccessRequest,
  AccessRequestItem,
  AccessRequestStatus,
  AccessRequestItemStatus,
} from '../../src/access-control/entities/access-request.entity';
import { SystemOwner } from '../../src/ownership/entities/system-owner.entity';

describe('User Portal - Limited View (Integration)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let systemRepository: Repository<System>;
  let instanceRepository: Repository<SystemInstance>;
  let tierRepository: Repository<AccessTier>;
  let grantRepository: Repository<AccessGrant>;
  let requestRepository: Repository<AccessRequest>;
  let requestItemRepository: Repository<AccessRequestItem>;
  let ownerRepository: Repository<SystemOwner>;

  let regularUser: User;
  let otherUser: User;
  let systemOwner: User;
  let testSystem: System;
  let testInstance: SystemInstance;
  let testTier: AccessTier;
  let regularUserToken: string;
  let systemOwnerToken: string;

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
          entities: [
            User,
            System,
            SystemInstance,
            AccessTier,
            AccessGrant,
            AccessRequest,
            AccessRequestItem,
            SystemOwner,
          ],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([
          User,
          System,
          SystemInstance,
          AccessTier,
          AccessGrant,
          AccessRequest,
          AccessRequestItem,
          SystemOwner,
        ]),
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
    instanceRepository = moduleFixture.get<Repository<SystemInstance>>(
      getRepositoryToken(SystemInstance),
    );
    tierRepository = moduleFixture.get<Repository<AccessTier>>(getRepositoryToken(AccessTier));
    grantRepository = moduleFixture.get<Repository<AccessGrant>>(getRepositoryToken(AccessGrant));
    requestRepository = moduleFixture.get<Repository<AccessRequest>>(
      getRepositoryToken(AccessRequest),
    );
    requestItemRepository = moduleFixture.get<Repository<AccessRequestItem>>(
      getRepositoryToken(AccessRequestItem),
    );
    ownerRepository = moduleFixture.get<Repository<SystemOwner>>(getRepositoryToken(SystemOwner));

    // Create test users
    const timestamp = Date.now();
    regularUser = await userRepository.save(
      userRepository.create({
        email: `regular-${timestamp}@test.com`,
        name: 'Regular User',
      }),
    );
    otherUser = await userRepository.save(
      userRepository.create({
        email: `other-${timestamp}@test.com`,
        name: 'Other User',
      }),
    );
    systemOwner = await userRepository.save(
      userRepository.create({
        email: `owner-${timestamp}@test.com`,
        name: 'System Owner',
      }),
    );

    // Create system and assign owner
    testSystem = await systemRepository.save(
      systemRepository.create({
        name: `Test System ${timestamp}`,
        description: 'Test',
      }),
    );
    testInstance = await instanceRepository.save(
      instanceRepository.create({
        systemId: testSystem.id,
        name: `Instance ${timestamp}`,
        region: 'US',
      }),
    );
    testTier = await tierRepository.save(
      tierRepository.create({
        systemId: testSystem.id,
        name: `tier-${timestamp}`,
        description: 'Test',
      }),
    );

    await ownerRepository.save(
      ownerRepository.create({
        userId: systemOwner.id,
        systemId: testSystem.id,
      }),
    );

    // Create grants for regular user
    await grantRepository.save(
      grantRepository.create({
        userId: regularUser.id,
        systemInstanceId: testInstance.id,
        accessTierId: testTier.id,
        status: AccessGrantStatus.ACTIVE,
        grantedById: systemOwner.id,
        grantedAt: new Date(),
      }),
    );

    // Create grant for other user (should not be visible to regular user)
    await grantRepository.save(
      grantRepository.create({
        userId: otherUser.id,
        systemInstanceId: testInstance.id,
        accessTierId: testTier.id,
        status: AccessGrantStatus.ACTIVE,
        grantedById: systemOwner.id,
        grantedAt: new Date(),
      }),
    );

    // Get tokens
    const regularLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: regularUser.email });
    regularUserToken = regularLogin.body.token;

    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: systemOwner.email });
    systemOwnerToken = ownerLogin.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up requests between tests
    const existingItems = await requestItemRepository.find();
    if (existingItems.length > 0) {
      await requestItemRepository.delete(existingItems.map((item) => item.id));
    }
    const existingRequests = await requestRepository.find();
    if (existingRequests.length > 0) {
      await requestRepository.delete(existingRequests.map((req) => req.id));
    }
  });

  describe('GET /api/v1/users/me/grants', () => {
    it('should return only grants for the authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users/me/grants')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].userId).toBe(regularUser.id);
      expect(response.body.data[0].user).toBeDefined();
      expect(response.body.data[0].systemInstance).toBeDefined();
      expect(response.body.data[0].systemInstance.system).toBeDefined();
      expect(response.body.data[0].accessTier).toBeDefined();
      expect(response.body.data[0].grantedBy).toBeDefined();
    });

    it('should return 401 if not authenticated', async () => {
      await request(app.getHttpServer()).get('/api/v1/users/me/grants').expect(401);
    });

    it('should not return grants for other users', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users/me/grants')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      const otherUserGrants = response.body.data.filter((g: any) => g.userId === otherUser.id);
      expect(otherUserGrants.length).toBe(0);
    });
  });

  describe('GET /api/v1/users/me/requests', () => {
    it('should return only requests for the authenticated user as requester or target', async () => {
      // Create request where regularUser is the target
      const request1 = await requestRepository.save(
        requestRepository.create({
          targetUserId: regularUser.id,
          requesterId: systemOwner.id,
          status: AccessRequestStatus.REQUESTED,
        }),
      );
      await requestItemRepository.save(
        requestItemRepository.create({
          accessRequestId: request1.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
          status: AccessRequestItemStatus.REQUESTED,
        }),
      );

      // Create request where regularUser is the requester
      const request2 = await requestRepository.save(
        requestRepository.create({
          targetUserId: otherUser.id,
          requesterId: regularUser.id,
          status: AccessRequestStatus.APPROVED,
        }),
      );
      await requestItemRepository.save(
        requestItemRepository.create({
          accessRequestId: request2.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
          status: AccessRequestItemStatus.APPROVED,
        }),
      );

      // Create request for other user (should not be visible)
      const request3 = await requestRepository.save(
        requestRepository.create({
          targetUserId: otherUser.id,
          requesterId: systemOwner.id,
          status: AccessRequestStatus.REQUESTED,
        }),
      );
      await requestItemRepository.save(
        requestItemRepository.create({
          accessRequestId: request3.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
          status: AccessRequestItemStatus.REQUESTED,
        }),
      );

      const response = await request(app.getHttpServer())
        .get('/api/v1/users/me/requests')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2);
      // Should include both requests where user is target or requester
      const requestIds = response.body.data.map((r: any) => r.id);
      expect(requestIds).toContain(request1.id);
      expect(requestIds).toContain(request2.id);
      expect(requestIds).not.toContain(request3.id);
    });

    it('should include request items with relations', async () => {
      const request1 = await requestRepository.save(
        requestRepository.create({
          targetUserId: regularUser.id,
          requesterId: systemOwner.id,
          status: AccessRequestStatus.REQUESTED,
        }),
      );
      await requestItemRepository.save(
        requestItemRepository.create({
          accessRequestId: request1.id,
          systemInstanceId: testInstance.id,
          accessTierId: testTier.id,
          status: AccessRequestItemStatus.REQUESTED,
        }),
      );

      const response = await request(app.getHttpServer())
        .get('/api/v1/users/me/requests')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      expect(response.body.data[0].items).toBeDefined();
      expect(response.body.data[0].items.length).toBe(1);
      expect(response.body.data[0].items[0].systemInstance).toBeDefined();
      expect(response.body.data[0].items[0].accessTier).toBeDefined();
    });

    it('should return 401 if not authenticated', async () => {
      await request(app.getHttpServer()).get('/api/v1/users/me/requests').expect(401);
    });
  });
});

