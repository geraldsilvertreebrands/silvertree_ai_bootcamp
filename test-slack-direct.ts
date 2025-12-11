/**
 * Direct Slack API Test
 * Run: npx ts-node test-slack-direct.ts
 */
import { WebClient } from '@slack/web-api';
import * as dotenv from 'dotenv';

dotenv.config();

async function testSlackIntegration() {
  const token = process.env.SLACK_BOT_TOKEN;
  const testEmail = process.env.TEST_SLACK_EMAIL || 'geralds@silvertreebrands.com';

  if (!token) {
    console.error('❌ SLACK_BOT_TOKEN not set in .env');
    process.exit(1);
  }

  if (!token.startsWith('xoxb-')) {
    console.error('❌ SLACK_BOT_TOKEN does not start with xoxb-');
    process.exit(1);
  }

  console.log('🔍 Testing Slack Integration...');
  console.log(`Token: ${token.substring(0, 10)}...`);
  console.log(`Test email: ${testEmail}\n`);

  const client = new WebClient(token);

  try {
    // Test 1: Lookup user by email
    console.log('1️⃣ Looking up Slack user by email...');
    const lookupResult = await client.users.lookupByEmail({ email: testEmail });
    
    if (!lookupResult.ok) {
      console.error(`❌ Lookup failed: ${lookupResult.error}`);
      process.exit(1);
    }

    if (!lookupResult.user?.id) {
      console.error(`❌ User not found in Slack for email: ${testEmail}`);
      console.log('   Make sure this email is a member of your Slack workspace');
      process.exit(1);
    }

    const slackUserId = lookupResult.user.id;
    console.log(`✅ Found Slack user:`);
    console.log(`   Name: ${lookupResult.user.name}`);
    console.log(`   ID: ${slackUserId}`);
    console.log(`   Email: ${lookupResult.user.profile?.email || 'N/A'}\n`);

    // Test 2: Send test message
    console.log('2️⃣ Sending test message...');
    const messageResult = await client.chat.postMessage({
      channel: slackUserId,
      text: '🧪 Test notification from Access Management System',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🧪 Test Notification',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'This is a *test notification* from the Access Management System.\n\nIf you received this, Slack integration is working! ✅',
          },
        },
      ],
    });

    if (!messageResult.ok) {
      console.error(`❌ Failed to send message: ${messageResult.error}`);
      process.exit(1);
    }

    console.log(`✅ Message sent successfully!`);
    console.log(`   Timestamp: ${messageResult.ts}`);
    console.log(`   Channel: ${messageResult.channel}\n`);
    console.log('🎉 Slack integration is working! Check your Slack for the test message.\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.data) {
      console.error('Error data:', JSON.stringify(error.data, null, 2));
    }
    process.exit(1);
  }
}

testSlackIntegration();



