/**
 * Direct test: Send Slack notification to verify it works
 */
import * as dotenv from 'dotenv';
import { WebClient } from '@slack/web-api';

dotenv.config();

async function testSlackDirect() {
  console.log('🔍 Testing Slack API directly...\n');

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.error('❌ SLACK_BOT_TOKEN not set in .env');
    process.exit(1);
  }

  console.log(`✓ SLACK_BOT_TOKEN: ${token.substring(0, 10)}...\n`);

  const client = new WebClient(token);
  const managerEmail = 'geralds@silvertreebrands.com';

  try {
    // Lookup user by email
    console.log(`1️⃣ Looking up Slack user for: ${managerEmail}`);
    const lookupResult = await client.users.lookupByEmail({ email: managerEmail });
    
    if (!lookupResult.ok) {
      console.error(`❌ Lookup failed: ${lookupResult.error}`);
      process.exit(1);
    }

    const slackUserId = lookupResult.user?.id;
    if (!slackUserId) {
      console.error(`❌ No user ID found for ${managerEmail}`);
      process.exit(1);
    }

    console.log(`   ✓ Found Slack user ID: ${slackUserId}`);
    console.log(`   ✓ User name: ${lookupResult.user?.name}\n`);

    // Send test message
    console.log(`2️⃣ Sending test message to ${slackUserId}...`);
    const messageResult = await client.chat.postMessage({
      channel: slackUserId,
      text: '🧪 TEST: Direct Slack API Test',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🧪 TEST: Direct Slack API Test',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'If you receive this, Slack API is working correctly!',
          },
        },
      ],
    });

    if (messageResult.ok) {
      console.log(`   ✓✓✓ SUCCESS: Message sent!`);
      console.log(`   ✓ Message timestamp: ${messageResult.ts}`);
      console.log(`\n📬 CHECK SLACK: ${managerEmail} should receive this test message\n`);
    } else {
      console.error(`   ❌ Failed to send: ${messageResult.error}`);
      process.exit(1);
    }

  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    if (error.data) {
      console.error(`   Error data: ${JSON.stringify(error.data, null, 2)}`);
    }
    process.exit(1);
  }
}

testSlackDirect().catch(console.error);




