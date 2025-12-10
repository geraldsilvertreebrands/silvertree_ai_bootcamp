/**
 * Debug: Test manager notification flow
 * Creates a request and verifies manager gets notified
 */
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const API_BASE = process.env.APP_BASE_URL || 'http://localhost:3000';

async function testManagerNotification() {
  console.log('🔍 Testing Manager Notification Flow...\n');

  const requesterEmail = 'sadyageraldm@gmail.com';
  const managerEmail = 'geralds@silvertreebrands.com';

  const requesterToken = Buffer.from(requesterEmail).toString('base64');
  const headers = {
    Authorization: `Bearer ${requesterToken}`,
    'Content-Type': 'application/json',
  };

  try {
    // Get users
    console.log('1️⃣ Getting users...');
    const usersResp = await axios.get(`${API_BASE}/api/v1/users`, { headers });
    const users = usersResp.data.data || usersResp.data || [];
    const requester = users.find((u: any) => u.email === requesterEmail);
    const manager = users.find((u: any) => u.email === managerEmail);

    if (!requester || !manager) {
      console.error(`❌ Users not found: requester=${!!requester}, manager=${!!manager}`);
      process.exit(1);
    }

    console.log(`   ✓ Requester: ${requester.email} (ID: ${requester.id})`);
    console.log(`   ✓ Manager: ${manager.email} (ID: ${manager.id})`);
    console.log(`   ✓ Requester managerId: ${requester.managerId}`);
    console.log(`   ✓ Manager matches: ${requester.managerId === manager.id}\n`);

    // Get system data
    console.log('2️⃣ Getting system data...');
    const systemsResp = await axios.get(`${API_BASE}/api/v1/systems`);
    const systems = systemsResp.data.data || systemsResp.data || [];
    const system = systems.find((s: any) => s.name === 'Acumatica') || systems[0];

    const instancesResp = await axios.get(`${API_BASE}/api/v1/systems/${system.id}/instances`);
    const instances = instancesResp.data.data || instancesResp.data || [];
    const instance = instances.find((i: any) => i.name === 'Production') || instances[0];

    const tiersResp = await axios.get(`${API_BASE}/api/v1/systems/${system.id}/access-tiers`);
    const tiers = tiersResp.data.data || tiersResp.data || [];
    const tier = tiers.find((t: any) => t.name === 'Accountant') || tiers[0];

    console.log(`   ✓ System: ${system.name}`);
    console.log(`   ✓ Instance: ${instance.name}`);
    console.log(`   ✓ Tier: ${tier.name}\n`);

    // Create request
    console.log('3️⃣ Creating request...');
    const createResp = await axios.post(
      `${API_BASE}/api/v1/access-requests`,
      {
        targetUserId: requester.id,
        items: [{ systemInstanceId: instance.id, accessTierId: tier.id }],
        note: 'Testing manager notification',
      },
      { headers },
    );

    const requestId = createResp.data.id;
    console.log(`   ✓ Request created: ${requestId}`);
    console.log(`   ✓ Status: ${createResp.data.status}`);
    console.log(`   ✓ Requester: ${createResp.data.requester?.email || 'NOT LOADED'}`);
    console.log(`   ✓ Target User: ${createResp.data.targetUser?.email || 'NOT LOADED'}`);
    console.log(`   ✓ Manager ID: ${createResp.data.targetUser?.managerId || 'NOT LOADED'}`);
    console.log(`   ✓ Manager loaded: ${!!createResp.data.targetUser?.manager}`);
    console.log(`   ✓ Manager email: ${createResp.data.targetUser?.manager?.email || 'NOT LOADED'}\n`);

    console.log('⏳ Waiting 5 seconds for Slack notification...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('📬 CHECK SLACK:');
    console.log(`   Manager (${managerEmail}) should receive: "Access Request" notification\n`);
    console.log('📋 Check server logs for:');
    console.log('   [AccessRequestService] Sending manager notification...');
    console.log('   [SlackNotificationAdapter] Looking up Slack user...');
    console.log('   [SlackNotificationAdapter] ✓ Successfully sent...\n');

  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testManagerNotification().catch(console.error);

