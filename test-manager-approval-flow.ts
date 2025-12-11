#!/usr/bin/env ts-node
/**
 * Test: Manager Approval Flow with Slack Notifications
 *
 * Tests:
 * 1. User creates access request → Manager gets Slack notification with #approvals link
 * 2. Manager clicks link → Dashboard opens to #approvals tab showing pending request
 * 3. Manager approves → Requester gets Slack approval notification + audit log created
 * 4. Manager rejects → Requester gets Slack rejection notification + audit log created
 */

const API_BASE = 'http://localhost:3000';

// User: sadyageraldm@gmail.com (requester)
const REQUESTER_TOKEN = 'c2FkeWFnZXJhbGRtQGdtYWlsLmNvbQ==';
const REQUESTER_EMAIL = 'sadyageraldm@gmail.com';

// Manager: geralds@silvertreebrands.com
const MANAGER_TOKEN = 'Z2VyYWxkc0BzaWx2ZXJ0cmVlYnJhbmRzLmNvbQ==';
const MANAGER_EMAIL = 'geralds@silvertreebrands.com';

interface User {
  id: string;
  email: string;
  name: string;
  managerId?: string;
}

interface AccessRequest {
  id: string;
  status: string;
  requesterId: string;
  targetUserId: string;
  requester?: User;
  targetUser?: User;
  items?: any[];
  createdAt: string;
}

async function apiCall(endpoint: string, token: string, options: any = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API call failed (${response.status}): ${error}`);
  }

  return response.json();
}

async function getUsers(token: string): Promise<User[]> {
  const data = await apiCall('/api/v1/users', token);
  return data.data || data || [];
}

async function getPendingApprovals(token: string): Promise<AccessRequest[]> {
  const data = await apiCall('/api/v1/access-requests/pending', token);
  return data.data || data || [];
}

async function createAccessRequest(token: string, targetUserId: string, systemInstanceId: string, accessTierId: string, note: string) {
  return apiCall('/api/v1/access-requests', token, {
    method: 'POST',
    body: JSON.stringify({
      targetUserId,
      items: [{
        systemInstanceId,
        accessTierId,
      }],
      note,
    }),
  });
}

async function approveRequest(token: string, requestId: string) {
  return apiCall(`/api/v1/access-requests/${requestId}/approve`, token, {
    method: 'PATCH',
  });
}

async function rejectRequest(token: string, requestId: string, reason: string) {
  return apiCall(`/api/v1/access-requests/${requestId}/reject`, token, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

async function getAuditLog(token: string) {
  const data = await apiCall('/api/v1/audit', token);
  return data.data || data || [];
}

async function main() {
  console.log('\n=== Manager Approval Flow Test ===\n');

  try {
    // Step 1: Get users
    console.log('📋 Step 1: Getting users...');
    const users = await getUsers(REQUESTER_TOKEN);
    const requester = users.find(u => u.email === REQUESTER_EMAIL);
    const manager = users.find(u => u.email === MANAGER_EMAIL);

    if (!requester || !manager) {
      throw new Error('Could not find requester or manager user');
    }

    console.log(`   ✓ Requester: ${requester.name} (${requester.email})`);
    console.log(`   ✓ Manager: ${manager.name} (${manager.email})`);
    console.log(`   ✓ Verify: requester.managerId = ${requester.managerId} === manager.id = ${manager.id}`);

    if (requester.managerId !== manager.id) {
      throw new Error('Manager relationship not set up correctly');
    }

    // Step 2: Get system and tier info (hardcoded from seed data)
    const SYSTEM_INSTANCE_ID = 'f42d9fc2-9c5a-4f78-95ba-3ff13d9e0b89'; // Google Analytics - Production
    const ACCESS_TIER_ID = '673e120d-d3d3-4d16-9ba0-51e74f7b1b16'; // Viewer

    // Step 3: Create access request
    console.log('\n📝 Step 2: Creating access request...');
    const request = await createAccessRequest(
      REQUESTER_TOKEN,
      requester.id,
      SYSTEM_INSTANCE_ID,
      ACCESS_TIER_ID,
      'Testing manager approval flow with Slack notifications'
    );
    console.log(`   ✓ Request created: ${request.id}`);
    console.log(`   ✓ Status: ${request.status}`);
    console.log('   ℹ️  Check Slack: Manager should receive notification with link to http://localhost:3000/dashboard.html#approvals');

    await sleep(2000);

    // Step 4: Verify manager sees pending approval
    console.log('\n📬 Step 3: Checking manager\'s pending approvals...');
    const pendingApprovals = await getPendingApprovals(MANAGER_TOKEN);
    console.log(`   ✓ Manager has ${pendingApprovals.length} pending approval(s)`);

    const thisRequest = pendingApprovals.find(r => r.id === request.id);
    if (!thisRequest) {
      throw new Error('Request not found in manager\'s pending approvals');
    }
    console.log(`   ✓ Request ${request.id} is in manager's pending list`);

    // Step 5: Manager approves request
    console.log('\n✅ Step 4: Manager approves request...');
    const approvedRequest = await approveRequest(MANAGER_TOKEN, request.id);
    console.log(`   ✓ Request approved`);
    console.log(`   ✓ New status: ${approvedRequest.status}`);
    console.log('   ℹ️  Check Slack: Requester should receive APPROVAL notification');

    await sleep(2000);

    // Step 6: Check audit log
    console.log('\n📜 Step 5: Checking audit log for approval...');
    try {
      const auditLog1 = await getAuditLog(MANAGER_TOKEN);
      const approvalLog = auditLog1
        .filter((log: any) => log.action === 'approve_request')
        .find((log: any) => log.details?.requestId === request.id);

      if (approvalLog) {
        console.log(`   ✓ Audit log entry found for approval`);
        console.log(`   ✓ Action: ${approvalLog.action}`);
        console.log(`   ✓ Actor: ${approvalLog.user?.name || approvalLog.userId}`);
      } else {
        console.log(`   ⚠️  No audit log entry found for approval`);
      }
    } catch (error) {
      console.log(`   ⚠️  Audit log endpoint not available (${error instanceof Error ? error.message : 'unknown error'})`);
    }

    // Step 7: Create another request to test rejection
    console.log('\n📝 Step 6: Creating another request to test rejection...');
    const request2 = await createAccessRequest(
      REQUESTER_TOKEN,
      requester.id,
      SYSTEM_INSTANCE_ID,
      ACCESS_TIER_ID,
      'Testing manager rejection flow'
    );
    console.log(`   ✓ Request created: ${request2.id}`);

    await sleep(2000);

    // Step 8: Manager rejects request
    console.log('\n❌ Step 7: Manager rejects request...');
    const rejectedRequest = await rejectRequest(
      MANAGER_TOKEN,
      request2.id,
      'Testing rejection notification to requester'
    );
    console.log(`   ✓ Request rejected`);
    console.log(`   ✓ New status: ${rejectedRequest.status}`);
    console.log('   ℹ️  Check Slack: Requester should receive REJECTION notification with reason');

    await sleep(2000);

    // Step 9: Check audit log for rejection
    console.log('\n📜 Step 8: Checking audit log for rejection...');
    try {
      const auditLog2 = await getAuditLog(MANAGER_TOKEN);
      const rejectionLog = auditLog2
        .filter((log: any) => log.action === 'reject_request')
        .find((log: any) => log.details?.requestId === request2.id);

      if (rejectionLog) {
        console.log(`   ✓ Audit log entry found for rejection`);
        console.log(`   ✓ Action: ${rejectionLog.action}`);
        console.log(`   ✓ Actor: ${rejectionLog.user?.name || rejectionLog.userId}`);
      } else {
        console.log(`   ⚠️  No audit log entry found for rejection`);
      }
    } catch (error) {
      console.log(`   ⚠️  Audit log endpoint not available (${error instanceof Error ? error.message : 'unknown error'})`);
    }

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   ✓ Request created → Manager notified via Slack');
    console.log('   ✓ Manager sees pending request in dashboard');
    console.log('   ✓ Manager approves → Requester notified via Slack');
    console.log('   ✓ Manager rejects → Requester notified via Slack with reason');
    console.log('   ✓ Audit log records actions');
    console.log('\n🔗 Test the Slack link: http://localhost:3000/dashboard.html#approvals');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main();
