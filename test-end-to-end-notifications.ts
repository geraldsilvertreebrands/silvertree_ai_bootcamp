/**
 * End-to-End Test: Verify notifications go to correct people
 * Tests the actual flow: Create → Manager notified → Approve → Requester notified
 */
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const API_BASE = process.env.APP_BASE_URL || 'http://localhost:3000';

async function testEndToEndNotifications() {
  console.log('🧪 End-to-End Notification Test\n');
  console.log('Testing: Create request → Manager gets notification → Approve → Requester gets notification\n');

  const requesterEmail = 'sadyageraldm@gmail.com';
  const managerEmail = 'geralds@silvertreebrands.com';

  const requesterToken = Buffer.from(requesterEmail).toString('base64');
  const managerToken = Buffer.from(managerEmail).toString('base64');
  const headers = {
    Authorization: `Bearer ${requesterToken}`,
    'Content-Type': 'application/json',
  };
  const managerHeaders = {
    Authorization: `Bearer ${managerToken}`,
    'Content-Type': 'application/json',
  };

  try {
    // Step 1: Get users
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
    console.log(`   ✓ Manager: ${manager.email} (ID: ${manager.id})\n`);

    // Step 2: Get system data
    console.log('2️⃣ Getting system data...');
    const systemsResp = await axios.get(`${API_BASE}/api/v1/systems`);
    const systems = systemsResp.data.data || systemsResp.data || [];
    const system = systems.find((s: any) => s.name === 'Shopify') || systems[0];

    if (!system) {
      console.error('❌ No system found');
      process.exit(1);
    }

    const instancesResp = await axios.get(`${API_BASE}/api/v1/systems/${system.id}/instances`);
    const instances = instancesResp.data.data || instancesResp.data || [];
    const instance = instances.find((i: any) => i.name === 'Pet Heaven Staging') || instances[0];

    const tiersResp = await axios.get(`${API_BASE}/api/v1/systems/${system.id}/access-tiers`);
    const tiers = tiersResp.data.data || tiersResp.data || [];
    const tier = tiers.find((t: any) => t.name === 'Admin') || tiers[0];

    console.log(`   ✓ System: ${system.name}`);
    console.log(`   ✓ Instance: ${instance.name}`);
    console.log(`   ✓ Tier: ${tier.name}\n`);

    // Step 3: Create request (requester requests for themselves)
    console.log('3️⃣ Creating request...');
    const createResp = await axios.post(
      `${API_BASE}/api/v1/access-requests`,
      {
        targetUserId: requester.id,
        items: [{ systemInstanceId: instance.id, accessTierId: tier.id }],
        note: 'Testing notification flow',
      },
      { headers },
    );

    const requestId = createResp.data.id;
    console.log(`   ✓ Request created: ${requestId}`);
    console.log(`   ✓ Status: ${createResp.data.status}`);
    console.log(`   ✓ Requester: ${createResp.data.requester?.email || 'NOT LOADED'}`);
    console.log(`   ✓ Manager: ${createResp.data.targetUser?.manager?.email || 'NOT LOADED'}\n`);

    console.log('⏳ Waiting 3 seconds for manager notification...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('📬 CHECK SLACK:');
    console.log(`   Manager (${managerEmail}) should receive: "Access Request" notification`);
    console.log(`   Requester (${requesterEmail}) should NOT receive anything yet\n`);

    // Step 4: Manager approves
    console.log('4️⃣ Manager approving request...');
    const approveResp = await axios.patch(
      `${API_BASE}/api/v1/access-requests/${requestId}/approve`,
      {},
      { headers: managerHeaders },
    );

    console.log(`   ✓ Request approved: ${approveResp.data.status}`);
    console.log(`   ✓ Requester: ${approveResp.data.requester?.email || 'NOT LOADED'}\n`);

    console.log('⏳ Waiting 3 seconds for requester notification...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('📬 CHECK SLACK:');
    console.log(`   Requester (${requesterEmail}) should receive: "Request Approved" notification`);
    console.log(`   Manager (${managerEmail}) should NOT receive approval notification\n`);

    console.log('✅ Test complete! Verify Slack notifications match expectations above.\n');

  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testEndToEndNotifications().catch(console.error);




