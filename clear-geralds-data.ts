/**
 * Clear all access requests and grants for geralds@silvertreebrands.com
 */
import { DataSource } from 'typeorm';
import { User } from './src/identity/entities/user.entity';
import { AccessRequest, AccessRequestItem } from './src/access-control/entities/access-request.entity';
import { AccessGrant } from './src/access-control/entities/access-grant.entity';
import { SystemInstance } from './src/systems/entities/system-instance.entity';
import { AccessTier } from './src/systems/entities/access-tier.entity';
import { System } from './src/systems/entities/system.entity';
import * as dotenv from 'dotenv';

dotenv.config();

async function clearGeraldsData() {
  console.log('🧹 Clearing all access requests and grants for geralds@silvertreebrands.com...\n');

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'bootcamp_access',
    entities: [User, AccessRequest, AccessRequestItem, AccessGrant, SystemInstance, AccessTier, System],
  });

  await dataSource.initialize();

  const userRepo = dataSource.getRepository(User);
  const requestRepo = dataSource.getRepository(AccessRequest);
  const requestItemRepo = dataSource.getRepository(AccessRequestItem);
  const grantRepo = dataSource.getRepository(AccessGrant);

  // Find geralds user
  const geralds = await userRepo.findOne({
    where: { email: 'geralds@silvertreebrands.com' },
  });

  if (!geralds) {
    console.error('❌ geralds@silvertreebrands.com not found');
    process.exit(1);
  }

  console.log(`✅ Found user: ${geralds.email} (ID: ${geralds.id})\n`);

  // Find all users who have geralds as their manager
  const usersWithGeraldsAsManager = await userRepo.find({
    where: { managerId: geralds.id },
  });
  const managedUserIds = usersWithGeraldsAsManager.map(u => u.id);
  
  if (managedUserIds.length > 0) {
    console.log(`👥 Found ${managedUserIds.length} user(s) with geralds as manager:`);
    managedUserIds.forEach(async (userId) => {
      const user = await userRepo.findOne({ where: { id: userId } });
      console.log(`   - ${user?.email || userId}`);
    });
    console.log();
  }

  // Delete access request items first (foreign key constraint)
  // Include requests where geralds is requester, target, OR manager of target
  const requestQuery = requestRepo
    .createQueryBuilder('request')
    .leftJoinAndSelect('request.targetUser', 'targetUser')
    .where('request.requesterId = :geraldsId', { geraldsId: geralds.id })
    .orWhere('request.targetUserId = :geraldsId', { geraldsId: geralds.id });
  
  if (managedUserIds.length > 0) {
    requestQuery.orWhere('targetUser.managerId = :geraldsId', { geraldsId: geralds.id });
  }
  
  const requests = await requestQuery.getMany();

  if (requests.length > 0) {
    console.log(`📋 Found ${requests.length} access request(s) (as requester, target, or manager)`);
    for (const request of requests) {
      // Delete items
      await requestItemRepo.delete({ accessRequestId: request.id });
      console.log(`   ✓ Deleted items for request ${request.id}`);
      console.log(`     Requester: ${request.requesterId === geralds.id ? 'geralds' : 'other'}`);
      console.log(`     Target: ${request.targetUserId === geralds.id ? 'geralds' : 'other'}`);
      console.log(`     Manager match: ${request.targetUser?.managerId === geralds.id ? 'yes' : 'no'}`);
    }
    // Delete requests
    for (const request of requests) {
      await requestRepo.delete({ id: request.id });
    }
    console.log(`   ✓ Deleted ${requests.length} access request(s)\n`);
  } else {
    console.log(`   ✓ No access requests found\n`);
  }

  // Delete access grants
  const grants = await grantRepo.find({
    where: { userId: geralds.id },
  });

  if (grants.length > 0) {
    console.log(`🔑 Found ${grants.length} access grant(s)`);
    await grantRepo.delete({ userId: geralds.id });
    console.log(`   ✓ Deleted ${grants.length} access grant(s)\n`);
  } else {
    console.log(`   ✓ No access grants found\n`);
  }

  console.log('✅ All data cleared for geralds@silvertreebrands.com!\n');

  await dataSource.destroy();
}

clearGeraldsData().catch(console.error);

