/**
 * Clear ALL test data: requests and grants for both geralds and sadyageraldm
 */
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

async function clearAllTestData() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'access_management',
    entities: ['src/**/*.entity.ts'],
    synchronize: false,
  });

  await dataSource.initialize();

  const userRepository = dataSource.getRepository('User');
  const requestRepository = dataSource.getRepository('AccessRequest');
  const requestItemRepository = dataSource.getRepository('AccessRequestItem');
  const grantRepository = dataSource.getRepository('AccessGrant');

  console.log('🧹 Clearing ALL test data...\n');

  // Find test users
  const geralds = await userRepository.findOne({ where: { email: 'geralds@silvertreebrands.com' } });
  const sadyageraldm = await userRepository.findOne({ where: { email: 'sadyageraldm@gmail.com' } });

  const userIds = [];
  if (geralds) {
    userIds.push(geralds.id);
    console.log(`✓ Found: ${geralds.email} (ID: ${geralds.id})`);
  }
  if (sadyageraldm) {
    userIds.push(sadyageraldm.id);
    console.log(`✓ Found: ${sadyageraldm.email} (ID: ${sadyageraldm.id})`);
  }

  if (userIds.length === 0) {
    console.log('❌ No test users found');
    await dataSource.destroy();
    return;
  }

  // Find all requests where these users are involved (as requester, target, or manager)
  const allRequests = await requestRepository.find({
    where: [
      { requesterId: { $in: userIds } as any },
      { targetUserId: { $in: userIds } as any },
    ],
    relations: ['items'],
  });

  // Also find requests where these users are managers
  const usersAsManagers = await userRepository.find({
    where: { managerId: { $in: userIds } as any },
  });
  const managerUserIds = usersAsManagers.map(u => u.id);
  if (managerUserIds.length > 0) {
    const managerRequests = await requestRepository.find({
      where: { targetUserId: { $in: managerUserIds } as any },
      relations: ['items'],
    });
    allRequests.push(...managerRequests);
  }

  // Remove duplicates
  const uniqueRequests = Array.from(new Map(allRequests.map(r => [r.id, r])).values());

  console.log(`\n📋 Found ${uniqueRequests.length} access request(s)`);
  for (const request of uniqueRequests) {
    console.log(`   Deleting request ${request.id}...`);
    if (request.items && request.items.length > 0) {
      await requestItemRepository.delete({ accessRequestId: request.id });
      console.log(`     ✓ Deleted ${request.items.length} item(s)`);
    }
    await requestRepository.delete({ id: request.id });
    console.log(`     ✓ Deleted request`);
  }

  // Find all grants for these users
  const allGrants = await grantRepository.find({
    where: { userId: { $in: userIds } as any },
  });

  console.log(`\n📋 Found ${allGrants.length} access grant(s)`);
  if (allGrants.length > 0) {
    await grantRepository.delete({ userId: { $in: userIds } as any });
    console.log(`   ✓ Deleted ${allGrants.length} grant(s)`);
  }

  console.log('\n✅ All test data cleared!\n');
  await dataSource.destroy();
}

clearAllTestData().catch(console.error);



