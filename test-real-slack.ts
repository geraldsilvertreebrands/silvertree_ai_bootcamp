/**
 * REAL Slack Notification Test
 * Actually sends a message to Slack to verify it works
 */
import { WebClient } from '@slack/web-api';
import * as dotenv from 'dotenv';

dotenv.config();

async function testRealSlack() {
  console.log('🔍 Testing REAL Slack Notification...\n');

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.error('❌ SLACK_BOT_TOKEN is not set in .env file');
    process.exit(1);
  }

  console.log(`Token: ${token.substring(0, 10)}...`);
  console.log(`ENABLE_SLACK: ${process.env.ENABLE_SLACK}\n`);

  const client = new WebClient(token);

  // Test 1: Lookup user by email
  const testEmail = 'geralds@silvertreebrands.com';
  console.log(`1️⃣ Looking up Slack user for: ${testEmail}...`);

  try {
    const lookupResult = await client.users.lookupByEmail({ email: testEmail });
    
    if (!lookupResult.ok || !lookupResult.user) {
      console.error(`❌ Could not find Slack user: ${lookupResult.error || 'Unknown error'}`);
      process.exit(1);
    }

    const slackUserId = lookupResult.user.id;
    if (!slackUserId) {
      console.error(`❌ Slack user ID is undefined`);
      process.exit(1);
    }

    console.log(`✅ Found Slack user:`);
    console.log(`   Name: ${lookupResult.user.real_name}`);
    console.log(`   ID: ${slackUserId}`);
    console.log(`   Email: ${lookupResult.user.profile?.email}\n`);

    // Test 2: Send actual message
    console.log(`2️⃣ Sending REAL test message to ${testEmail}...\n`);

    const messageResult = await client.chat.postMessage({
      channel: slackUserId,
      text: '🧪 REAL TEST: Access Request Notification',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🧪 REAL TEST: Access Request',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*This is a REAL test message*\n\nIf you received this, Slack integration is working! ✅`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*System:*\nMagento`,
            },
            {
              type: 'mrkdwn',
              text: `*Instance:*\nUCOOK Production`,
            },
            {
              type: 'mrkdwn',
              text: `*Access Level:*\nViewer`,
            },
            {
              type: 'mrkdwn',
              text: `*Justification:*\nTest notification`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `_Sent at ${new Date().toLocaleString()}_`,
            },
          ],
        },
      ],
    });

    if (messageResult.ok) {
      console.log('✅ Message sent successfully!');
      console.log(`   Timestamp: ${messageResult.ts}`);
      console.log(`   Channel: ${messageResult.channel}`);
      console.log(`\n🎉 Check Slack for ${testEmail} - you should see the test message!\n`);
    } else {
      console.error(`❌ Failed to send message: ${messageResult.error}`);
      process.exit(1);
    }

  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    if (error.data) {
      console.error(`   Data:`, JSON.stringify(error.data, null, 2));
    }
    process.exit(1);
  }
}

testRealSlack().catch(console.error);

