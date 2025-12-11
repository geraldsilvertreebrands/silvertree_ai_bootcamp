import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { User } from './identity/entities/user.entity';
import { System } from './systems/entities/system.entity';
import { SystemInstance } from './systems/entities/system-instance.entity';
import { AccessTier } from './systems/entities/access-tier.entity';
import { SystemOwner } from './ownership/entities/system-owner.entity';
import { AccessGrant } from './access-control/entities/access-grant.entity';
import { AuditLog } from './access-control/entities/audit-log.entity';
import { IdentityModule } from './identity/identity.module';
import { SystemsModule } from './systems/systems.module';
import { AccessControlModule } from './access-control/access-control.module';
import { OwnershipModule } from './ownership/ownership.module';
import { AuthModule } from './auth/auth.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { AccessRequest, AccessRequestItem } from './access-control/entities/access-request.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
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
        SystemOwner,
        AccessGrant,
        AccessRequest,
        AccessRequestItem,
        AuditLog,
      ],
      synchronize: false, // NEVER use true - always use migrations for schema changes
      logging: process.env.NODE_ENV === 'development',
    }),
    IdentityModule,
    SystemsModule,
    AccessControlModule,
    OwnershipModule,
    AuthModule,
    IntegrationsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
