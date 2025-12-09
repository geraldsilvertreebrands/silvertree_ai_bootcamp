import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { seedDatabase } from './seed';
import { User } from '../identity/entities/user.entity';
import { System } from '../systems/entities/system.entity';
import { SystemInstance } from '../systems/entities/system-instance.entity';
import { AccessTier } from '../systems/entities/access-tier.entity';
import { SystemOwner } from '../ownership/entities/system-owner.entity';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { AccessRequest, AccessRequestItem } from '../access-control/entities/access-request.entity';

config();

const dataSource = new DataSource({
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
  ],
  synchronize: false,
  logging: false,
});

async function runSeed() {
  try {
    await dataSource.initialize();
    console.log('📦 Database connected');
    await seedDatabase(dataSource);
    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

runSeed();




