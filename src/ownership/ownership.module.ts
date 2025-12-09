import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemOwner } from './entities/system-owner.entity';
import { User } from '../identity/entities/user.entity';
import { System } from '../systems/entities/system.entity';
import { SystemOwnerService } from './services/system-owner.service';
import {
  SystemOwnersController,
  UserOwnedSystemsController,
} from './controllers/system-owners.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SystemOwner, User, System])],
  controllers: [SystemOwnersController, UserOwnedSystemsController],
  providers: [SystemOwnerService],
  exports: [SystemOwnerService],
})
export class OwnershipModule {}




