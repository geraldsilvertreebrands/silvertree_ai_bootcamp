/**
 * Test Notification Flow - Actually creates a request and verifies Slack notification
 */
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const API_BASE = process.env.APP_BASE_URL || 'http://localhost:3000';

async function testNotificationFlow() {
  console.log('🔍 Testing REAL Notification Flow...\n');

  // Get user and system data via API
  const token = Buffer.from('geralds@silvertreebrands.com').toString('base64');
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    // Get users
    const usersResp = await axios.get(`${API_BASE}/api/v1/users`, { headers });
    const users = usersResp.data.data || usersResp.data || [];
    const geralds = users.find((u: any) => u.email === 'geralds@silvertreebrands.com');

    if (!geralds) {
      console.error('❌ geralds@silvertreebrands.com not found');
      process.exit(1);
    }

    console.log(`✅ Found user: ${geralds.email}`);
    console.log(`   ID: ${geralds.id}`);

    // Get systems
    const systemsResp = await axios.get(`${API_BASE}/api/v1/systems`);
    const systems = systemsResp.data.data || systemsResp.data || [];
    const system = systems.find((s: any) => s.name === 'Magento');

    if (!system) {
      console.error('❌ Magento system not found');
      process.exit(1);
    }

    // Get instances
    const instancesResp = await axios.get(`${API_BASE}/api/v1/systems/${system.id}/instances`);
    const instances = instancesResp.data.data || instancesResp.data || [];
    const instance = instances[0];

    if (!instance) {
      console.error('❌ No instance found');
      process.exit(1);
    }

    // Get tiers
    const tiersResp = await axios.get(`${API_BASE}/api/v1/systems/${system.id}/access-tiers`);
    const tiers = tiersResp.data.data || tiersResp.data || [];
    const tier = tiers[0];

    if (!tier) {
      console.error('❌ No tier found');
      process.exit(1);
    }

    console.log(`\n📤 Creating request via API...\n`);

    const response = await axios.post(
      `${API_BASE}/api/v1/access-requests`,
      {
        targetUserId: geralds.id,
        items: [
          {
            systemInstanceId: instance.id,
            accessTierId: tier.id,
          },
        ],
        note: 'Test notification flow',
      },
      { headers },
    );

    console.log(`✅ Request created:`);
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Status: ${response.data.status}`);
    console.log(`   Target User: ${response.data.targetUser?.email || 'NOT LOADED'}`);
    console.log(`   Manager: ${response.data.targetUser?.manager?.email || 'NOT LOADED'}`);
    console.log(`\n⏳ Waiting 3 seconds for notification...\n`);
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log(`\n🎉 Check Slack for geralds@silvertreebrands.com!\n`);
    console.log(`   You should see a notification about the access request.\n`);

  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testNotificationFlow().catch(console.error);
