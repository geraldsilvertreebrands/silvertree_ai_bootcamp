import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { System } from './entities/system.entity';
import { SystemInstance } from './entities/system-instance.entity';
import { AccessTier } from './entities/access-tier.entity';
import { SystemService } from './services/system.service';
import { SystemInstanceService } from './services/system-instance.service';
import { AccessTierService } from './services/access-tier.service';
import { SystemsController } from './controllers/systems.controller';
import { SystemInstancesController } from './controllers/system-instances.controller';
import { AccessTiersController } from './controllers/access-tiers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([System, SystemInstance, AccessTier])],
  controllers: [SystemsController, SystemInstancesController, AccessTiersController],
  providers: [SystemService, SystemInstanceService, AccessTierService],
  exports: [SystemService, SystemInstanceService, AccessTierService],
})
export class SystemsModule {}
