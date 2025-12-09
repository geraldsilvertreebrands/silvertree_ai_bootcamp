import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessRequestService } from '../../src/access-control/services/access-request.service';
import { AccessGrantService } from '../../src/access-control/services/access-grant.service';
import { AccessGrant, AccessGrantStatus } from '../../src/access-control/entities/access-grant.entity';
import {
  AccessRequest,
  AccessRequestItem,
  AccessRequestItemStatus,
  AccessRequestStatus,
} from '../../src/access-control/entities/access-request.entity';
import { AccessTier } from '../../src/systems/entities/access-tier.entity';
import { SystemInstance } from '../../src/systems/entities/system-instance.entity';
import { System } from '../../src/systems/entities/system.entity';
import { User } from '../../src/identity/entities/user.entity';
import { CreateAccessRequestDto } from '../../src/access-control/dto/create-access-request.dto';
import { CsvParserService } from '../../src/access-control/services/csv-parser.service';
import { AccessControlModule } from '../../src/access-control/access-control.module';
import { IdentityModule } from '../../src/identity/identity.module';
import { SystemsModule } from '../../src/systems/systems.module';
import { OwnershipModule } from '../../src/ownership/ownership.module';
import { AuthModule } from '../../src/auth/auth.module';
import { SystemOwner } from '../../src/ownership/entities/system-owner.entity';

describe('AccessRequestService (Integration)', () => {
  let module: TestingModule;
  let accessRequestService: AccessRequestService;
  let accessGrantService: AccessGrantService;
  let userRepo: Repository<User>;
  let systemRepo: Repository<System>;
  let instanceRepo: Repository<SystemInstance>;
  let tierRepo: Repository<AccessTier>;
  let grantRepo: Repository<AccessGrant>;
  let requestRepo: Repository<AccessRequest>;
  let requestItemRepo: Repository<AccessRequestItem>;

  let managerUser: User;
  let reportUser: User;
  let nonManagerUser: User;
  let system: System;
  let instance: SystemInstance;
  let tier: AccessTier;

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

    accessRequestService = module.get<AccessRequestService>(AccessRequestService);
    accessGrantService = module.get<AccessGrantService>(AccessGrantService);
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    systemRepo = module.get<Repository<System>>(getRepositoryToken(System));
    instanceRepo = module.get<Repository<SystemInstance>>(getRepositoryToken(SystemInstance));
    tierRepo = module.get<Repository<AccessTier>>(getRepositoryToken(AccessTier));
    grantRepo = module.get<Repository<AccessGrant>>(getRepositoryToken(AccessGrant));
    requestRepo = module.get<Repository<AccessRequest>>(getRepositoryToken(AccessRequest));
    requestItemRepo = module.get<Repository<AccessRequestItem>>(getRepositoryToken(AccessRequestItem));

    const timestamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    managerUser = await userRepo.save(
      userRepo.create({
        email: `manager-${timestamp}@test.com`,
        name: 'Manager User',
      }),
    );

    reportUser = await userRepo.save(
      userRepo.create({
        email: `report-${timestamp}@test.com`,
        name: 'Report User',
        managerId: managerUser.id,
      }),
    );

    nonManagerUser = await userRepo.save(
      userRepo.create({
        email: `nonmanager-${timestamp}@test.com`,
        name: 'Non Manager',
      }),
    );

    system = await systemRepo.save(
      systemRepo.create({
        name: `System ${timestamp}`,
        description: 'Test',
      }),
    );

    instance = await instanceRepo.save(
      instanceRepo.create({
        systemId: system.id,
        name: `Instance ${timestamp}`,
        region: 'ZA',
      }),
    );

    tier = await tierRepo.save(
      tierRepo.create({
        systemId: system.id,
        name: `admin-${timestamp}`,
        description: 'Admin tier',
      }),
    );
  });

  afterAll(async () => {
    try {
      await requestItemRepo.delete({ id: undefined as any });
    } catch (err) {
      // ignore
    }
    await module.close();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  beforeEach(async () => {
    await requestItemRepo.query('DELETE FROM access_request_items');
    await requestRepo.query('DELETE FROM access_requests');
    await grantRepo.query('DELETE FROM access_grants');
  });

  const makeDto = (): CreateAccessRequestDto => ({
    targetUserId: reportUser.id,
    items: [
      {
        systemInstanceId: instance.id,
        accessTierId: tier.id,
      },
    ],
  });

  it('manager requester auto-approves and creates grant', async () => {
    const dto = makeDto();
    const result = await accessRequestService.create(dto, managerUser.id);

    expect(result.status).toBe(AccessRequestStatus.APPROVED);
    expect(result.items[0].status).toBe(AccessRequestItemStatus.APPROVED);

    const grants = await grantRepo.find({
      where: {
        userId: reportUser.id,
        systemInstanceId: instance.id,
        accessTierId: tier.id,
        status: AccessGrantStatus.ACTIVE,
      },
    });
    expect(grants.length).toBe(1);
  });

  it('non-manager requester leaves request/items requested and does not create grants', async () => {
    const dto = makeDto();
    const result = await accessRequestService.create(dto, nonManagerUser.id);

    expect(result.status).toBe(AccessRequestStatus.REQUESTED);
    expect(result.items[0].status).toBe(AccessRequestItemStatus.REQUESTED);

    const grants = await grantRepo.find({
      where: {
        userId: reportUser.id,
        systemInstanceId: instance.id,
        accessTierId: tier.id,
      },
    });
    expect(grants.length).toBe(0);
  });

  it('manager auto-approve does not create duplicate active grants', async () => {
    await grantRepo.save(
      grantRepo.create({
        userId: reportUser.id,
        systemInstanceId: instance.id,
        accessTierId: tier.id,
        status: AccessGrantStatus.ACTIVE,
      }),
    );

    const dto = makeDto();
    const result = await accessRequestService.create(dto, managerUser.id);

    expect(result.status).toBe(AccessRequestStatus.APPROVED);
    expect(result.items[0].status).toBe(AccessRequestItemStatus.APPROVED);

    const grants = await grantRepo.find({
      where: {
        userId: reportUser.id,
        systemInstanceId: instance.id,
        accessTierId: tier.id,
        status: AccessGrantStatus.ACTIVE,
      },
    });
    expect(grants.length).toBe(1);
  });
});

