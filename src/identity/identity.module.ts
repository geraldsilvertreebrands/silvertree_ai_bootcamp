import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserService } from './services/user.service';
import { UsersController } from './controllers/users.controller';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { AccessRequest } from '../access-control/entities/access-request.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, AccessGrant, AccessRequest]),
    AuthModule,
  ],
  controllers: [UsersController],
  providers: [UserService],
  exports: [UserService],
})
export class IdentityModule {}
