import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserService } from './services/user.service';
import { UsersController } from './controllers/users.controller';
import { AccessGrant } from '../access-control/entities/access-grant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, AccessGrant])],
  controllers: [UsersController],
  providers: [UserService],
  exports: [UserService],
})
export class IdentityModule {}
