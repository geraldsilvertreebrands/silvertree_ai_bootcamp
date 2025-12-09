import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessGrant } from './entities/access-grant.entity';
import { AccessRequest, AccessRequestItem } from './entities/access-request.entity';
import { User } from '../identity/entities/user.entity';
import { System } from '../systems/entities/system.entity';
import { SystemInstance } from '../systems/entities/system-instance.entity';
import { AccessTier } from '../systems/entities/access-tier.entity';
import { AccessGrantQueryService } from './services/access-grant-query.service';
import { AccessGrantService } from './services/access-grant.service';
import { CsvParserService } from './services/csv-parser.service';
import { AccessOverviewController } from './controllers/access-overview.controller';
import { AccessGrantsController } from './controllers/access-grants.controller';
import { AccessRequestsController } from './controllers/access-requests.controller';
import { SystemOwnerGuard } from '../common/guards/system-owner.guard';
import { SystemOwnerService } from '../ownership/services/system-owner.service';
import { SystemOwner } from '../ownership/entities/system-owner.entity';
import { AuthModule } from '../auth/auth.module';
import { OwnershipModule } from '../ownership/ownership.module';
import { AccessRequestService } from './services/access-request.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccessGrant,
      AccessRequest,
      AccessRequestItem,
      User,
      System,
      SystemInstance,
      AccessTier,
      SystemOwner,
    ]),
    AuthModule,
    OwnershipModule,
  ],
  controllers: [AccessOverviewController, AccessGrantsController, AccessRequestsController],
  providers: [
    AccessGrantQueryService,
    AccessGrantService,
    AccessRequestService,
    CsvParserService,
    SystemOwnerGuard,
  ],
  exports: [AccessGrantQueryService, AccessGrantService, AccessRequestService, CsvParserService],
})
export class AccessControlModule {}
