/**
 * Debug: Check what pending approvals exist and why
 */
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const API_BASE = process.env.APP_BASE_URL || 'http://localhost:3000';

async function checkPendingApprovals() {
  console.log('🔍 Checking Pending Approvals...\n');

  const geraldsEmail = 'geralds@silvertreebrands.com';
  const geraldsToken = Buffer.from(geraldsEmail).toString('base64');
  const headers = {
    Authorization: `Bearer ${geraldsToken}`,
    'Content-Type': 'application/json',
  };

  try {
    // Get current user
    console.log('1️⃣ Getting current user...');
    const meResp = await axios.get(`${API_BASE}/api/v1/auth/me`, { headers });
    const meData = meResp.data;
    console.log(`   Current user: ${meData.email} (ID: ${meData.id})\n`);

    // Get all requests for this user
    console.log('2️⃣ Getting all access requests...');
    const allRequestsResp = await axios.get(`${API_BASE}/api/v1/access-requests`, { headers });
    const allRequests = Array.isArray(allRequestsResp.data) ? allRequestsResp.data : (allRequestsResp.data.data || []);
    console.log(`   Total requests: ${allRequests.length}\n`);

    if (allRequests.length > 0) {
      console.log('📋 All Requests:');
      allRequests.forEach((req: any, idx: number) => {
        console.log(`\n   Request ${idx + 1}:`);
        console.log(`     ID: ${req.id}`);
        console.log(`     Status: ${req.status}`);
        console.log(`     Requester: ${req.requester?.email || req.requesterId || 'N/A'}`);
        console.log(`     Target User: ${req.targetUser?.email || req.targetUserId || 'N/A'}`);
        console.log(`     Target User Manager ID: ${req.targetUser?.managerId || 'N/A'}`);
        console.log(`     Target User Manager Email: ${req.targetUser?.manager?.email || 'N/A'}`);
        console.log(`     Created: ${req.createdAt}`);
        console.log(`     Updated: ${req.updatedAt}`);
        console.log(`     Items: ${req.items?.length || 0}`);
      });
    }

    // Get pending approvals specifically
    console.log('\n3️⃣ Getting pending approvals (manager endpoint)...');
    try {
      const pendingResp = await axios.get(`${API_BASE}/api/v1/access-requests/pending`, { headers });
      const pendingRequests = Array.isArray(pendingResp.data) ? pendingResp.data : (pendingResp.data.data || []);
      console.log(`   Pending approvals: ${pendingRequests.length}\n`);

      if (pendingRequests.length > 0) {
        console.log('⚠️  PENDING APPROVALS FOUND:');
        pendingRequests.forEach((req: any, idx: number) => {
          console.log(`\n   Pending ${idx + 1}:`);
          console.log(`     ID: ${req.id}`);
          console.log(`     Status: ${req.status}`);
          console.log(`     Requester: ${req.requester?.email || req.requesterId || 'N/A'}`);
          console.log(`     Target User: ${req.targetUser?.email || req.targetUserId || 'N/A'}`);
          console.log(`     Target User Manager ID: ${req.targetUser?.managerId || 'N/A'}`);
          console.log(`     Current User ID: ${meData.id}`);
          console.log(`     Manager Match: ${req.targetUser?.managerId === meData.id}`);
        });
      } else {
        console.log('   ✓ No pending approvals found');
      }
    } catch (error: any) {
      console.error(`   ❌ Error fetching pending approvals: ${error.response?.data || error.message}`);
    }

    // Check if geralds is anyone's manager
    console.log('\n4️⃣ Checking if geralds is anyone\'s manager...');
    const usersResp = await axios.get(`${API_BASE}/api/v1/users`, { headers });
    const users = usersResp.data.data || usersResp.data || [];
    const usersWithGeraldsAsManager = users.filter((u: any) => u.managerId === meData.id);
    console.log(`   Users with geralds as manager: ${usersWithGeraldsAsManager.length}`);
    if (usersWithGeraldsAsManager.length > 0) {
      usersWithGeraldsAsManager.forEach((u: any) => {
        console.log(`     - ${u.email} (ID: ${u.id})`);
      });
    }

  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkPendingApprovals().catch(console.error);



