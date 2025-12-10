/**
 * Delete the leftover request via API
 */
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const API_BASE = process.env.APP_BASE_URL || 'http://localhost:3000';

async function deleteLeftoverRequest() {
  console.log('🧹 Deleting leftover request...\n');

  const geraldsEmail = 'geralds@silvertreebrands.com';
  const geraldsToken = Buffer.from(geraldsEmail).toString('base64');
  const headers = {
    Authorization: `Bearer ${geraldsToken}`,
    'Content-Type': 'application/json',
  };

  try {
    // Get pending approvals
    const pendingResp = await axios.get(`${API_BASE}/api/v1/access-requests/pending`, { headers });
    const pendingRequests = Array.isArray(pendingResp.data) ? pendingResp.data : (pendingResp.data.data || []);

    console.log(`Found ${pendingRequests.length} pending request(s)\n`);

    for (const request of pendingRequests) {
      console.log(`Deleting request ${request.id}...`);
      console.log(`  Requester: ${request.requester?.email || request.requesterId}`);
      console.log(`  Target: ${request.targetUser?.email || request.targetUserId}`);
      console.log(`  Status: ${request.status}`);

      // First, delete all items
      if (request.items && request.items.length > 0) {
        for (const item of request.items) {
          try {
            // Note: There's no delete endpoint, so we'll need to reject it or use direct DB
            // For now, let's just log it - we'll need to use the DB directly
            console.log(`  Item ${item.id} needs to be deleted`);
          } catch (error: any) {
            console.error(`  Error deleting item: ${error.message}`);
          }
        }
      }

      // Since there's no DELETE endpoint, we'll need to use direct DB access
      // But for now, let's just document what needs to be deleted
      console.log(`  ⚠️  Request ${request.id} needs to be deleted from database\n`);
    }

    console.log('✅ Use the database directly to delete these requests.\n');
    console.log('Or use: DELETE FROM access_request_items WHERE access_request_id = \'...\';');
    console.log('      DELETE FROM access_requests WHERE id = \'...\';\n');

  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

deleteLeftoverRequest().catch(console.error);

