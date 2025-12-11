/**
 * Test Slack Notifications End-to-End
 * Creates requests, approves/rejects them, and verifies Slack notifications are sent
 */
import { DataSource } from 'typeorm';
import { User } from './src/identity/entities/user.entity';
import { System } from './src/systems/entities/system.entity';
import { SystemInstance } from './src/systems/entities/system-instance.entity';
import { AccessTier } from './src/systems/entities/access-tier.entity';
import { AccessRequest } from './src/access-control/entities/access-request.entity';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const API_BASE = process.env.APP_BASE_URL || 'http://localhost:3000';

async function testSlackNotifications() {
  console.log('🔍 Testing Slack Notifications End-to-End...\n');
  console.log(`API Base: ${API_BASE}`);
  console.log(`ENABLE_SLACK: ${process.env.ENABLE_SLACK}`);
  console.log(`SLACK_BOT_TOKEN: ${process.env.SLACK_BOT_TOKEN ? 'SET' : 'NOT SET'}\n`);

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'bootcamp_access',
    entities: [User, System, SystemInstance, AccessTier, AccessRequest],
  });

  await dataSource.initialize();

  const userRepo = dataSource.getRepository(User);
  const systemRepo = dataSource.getRepository(System);
  const instanceRepo = dataSource.getRepository(SystemInstance);
  const tierRepo = dataSource.getRepository(AccessTier);

  // Get test users
  const requester = await userRepo.findOne({
    where: { email: 'sadyageraldm@gmail.com' },
  });
  const manager = await userRepo.findOne({
    where: { email: 'geralds@silvertreebrands.com' },
  });

  if (!requester || !manager) {
    console.error('❌ Test users not found. Please run seed first.');
    process.exit(1);
  }

  // Set manager relationship
  requester.managerId = manager.id;
  await userRepo.save(requester);

  // Get test system
  const system = await systemRepo.findOne({ where: { name: 'Magento' } });
  if (!system) {
    console.error('❌ Magento system not found');
    process.exit(1);
  }

  const instance = await instanceRepo.findOne({
    where: { systemId: system.id },
  });
  if (!instance) {
    console.error('❌ No instance found for Magento');
    process.exit(1);
  }

  const tier = await tierRepo.findOne({
    where: { systemId: system.id },
  });
  if (!tier) {
    console.error('❌ No tier found for Magento');
    process.exit(1);
  }

  console.log('✅ Test data ready:');
  console.log(`   Requester: ${requester.email} (ID: ${requester.id})`);
  console.log(`   Manager: ${manager.email} (ID: ${manager.id})`);
  console.log(`   System: ${system.name}`);
  console.log(`   Instance: ${instance.name}`);
  console.log(`   Tier: ${tier.name}\n`);

  // Test 1: Create request (should notify manager)
  console.log('📤 Test 1: Creating request (should notify manager)...\n');
  const requesterToken = Buffer.from(requester.email).toString('base64');
  
  try {
    const createResponse = await axios.post(
      `${API_BASE}/api/v1/access-requests`,
      {
        targetUserId: requester.id,
        items: [
          {
            systemInstanceId: instance.id,
            accessTierId: tier.id,
          },
        ],
        note: 'Test notification flow',
      },
      {
        headers: {
          Authorization: `Bearer ${requesterToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const requestId = createResponse.data.id;
    console.log(`✅ Request created: ${requestId}`);
    console.log(`   Status: ${createResponse.data.status}`);
    console.log(`   Check Slack for manager notification to: ${manager.email}\n`);

    // Wait a bit for notification
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Manager approves (should notify requester)
    console.log('📤 Test 2: Manager approves (should notify requester)...\n');
    const managerToken = Buffer.from(manager.email).toString('base64');
    
    const approveResponse = await axios.patch(
      `${API_BASE}/api/v1/access-requests/${requestId}/approve`,
      {},
      {
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      },
    );

    console.log(`✅ Request approved: ${approveResponse.data.status}`);
    console.log(`   Check Slack for requester notification to: ${requester.email}\n`);

    // Wait a bit for notification
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Create another request and reject it
    console.log('📤 Test 3: Creating request for rejection test...\n');
    const createResponse2 = await axios.post(
      `${API_BASE}/api/v1/access-requests`,
      {
        targetUserId: requester.id,
        items: [
          {
            systemInstanceId: instance.id,
            accessTierId: tier.id,
          },
        ],
        note: 'Test rejection flow',
      },
      {
        headers: {
          Authorization: `Bearer ${requesterToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const requestId2 = createResponse2.data.id;
    console.log(`✅ Request created: ${requestId2}`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 4: Manager rejects (should notify requester with reason)
    console.log('📤 Test 4: Manager rejects (should notify requester with reason)...\n');
    const rejectResponse = await axios.patch(
      `${API_BASE}/api/v1/access-requests/${requestId2}/reject`,
      {
        reason: 'Access not needed for this role',
      },
      {
        headers: {
          Authorization: `Bearer ${managerToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    console.log(`✅ Request rejected: ${rejectResponse.data.status}`);
    console.log(`   Check Slack for requester notification to: ${requester.email}\n`);

    console.log('🎉 All tests complete! Check Slack for notifications:\n');
    console.log(`   Manager (${manager.email}) should receive:`);
    console.log(`   - Request notification for ${requestId}`);
    console.log(`   - Request notification for ${requestId2}\n`);
    console.log(`   Requester (${requester.email}) should receive:`);
    console.log(`   - Approval notification for ${requestId}`);
    console.log(`   - Rejection notification for ${requestId2} (with reason)\n`);

  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }

  await dataSource.destroy();
}

testSlackNotifications().catch(console.error);



