/**
 * Test Notification Flow
 * Simulates what happens when a request is created
 */
import { DataSource } from 'typeorm';
import { SlackNotificationAdapter } from './src/integrations/notifications/slack-notification.adapter';
import { NotificationContext } from './src/integrations/notifications/notification.interface';
import { AccessRequest, AccessRequestStatus } from './src/access-control/entities/access-request.entity';
import { AccessRequestItem, AccessRequestItemStatus } from './src/access-control/entities/access-request.entity';
import { User } from './src/identity/entities/user.entity';
import { SystemInstance } from './src/systems/entities/system-instance.entity';
import { AccessTier } from './src/systems/entities/access-tier.entity';
import { System } from './src/systems/entities/system.entity';
import { SystemOwnerService } from './src/ownership/services/system-owner.service';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';

dotenv.config();

async function testNotificationFlow() {
  console.log('🔍 Testing notification flow...\n');

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'bootcamp_access',
    entities: [User, System, SystemInstance, AccessTier],
  });

  await dataSource.initialize();

  const userRepo = dataSource.getRepository(User);
  const systemRepo = dataSource.getRepository(System);
  const instanceRepo = dataSource.getRepository(SystemInstance);
  const tierRepo = dataSource.getRepository(AccessTier);

  // Get geralds user with manager relation
  const geraldsUser = await userRepo.findOne({
    where: { email: 'geralds@silvertreebrands.com' },
    relations: ['manager'],
  });

  if (!geraldsUser) {
    console.error('❌ User geralds@silvertreebrands.com not found');
    process.exit(1);
  }

  console.log('✅ Found user:', geraldsUser.email);
  console.log('   Manager ID:', geraldsUser.managerId);
  console.log('   Manager loaded:', !!geraldsUser.manager);
  console.log('   Manager email:', geraldsUser.manager?.email || 'NOT LOADED\n');

  if (!geraldsUser.manager) {
    console.log('⚠️  Manager relation not loaded. Loading now...');
    if (geraldsUser.managerId) {
      geraldsUser.manager = await userRepo.findOne({
        where: { id: geraldsUser.managerId },
      });
      console.log('   Manager email after reload:', geraldsUser.manager?.email || 'NOT FOUND\n');
    }
  }

  // Get a system/instance/tier for the test
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

  console.log('✅ Found test data:');
  console.log(`   System: ${system.name}`);
  console.log(`   Instance: ${instance.name}`);
  console.log(`   Tier: ${tier.name}\n`);

  // Create mock request
  const mockRequest = {
    id: 'test-request-id',
    targetUserId: geraldsUser.id,
    targetUser: geraldsUser,
    requesterId: geraldsUser.id,
    requester: geraldsUser,
    status: AccessRequestStatus.REQUESTED,
    note: 'Test notification',
    items: [
      {
        id: 'test-item-id',
        systemInstanceId: instance.id,
        systemInstance: { ...instance, system },
        accessTierId: tier.id,
        accessTier: tier,
        status: AccessRequestItemStatus.REQUESTED,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as AccessRequest;

  // Test notification
  const configService = {
    get: (key: string, defaultValue?: string) => {
      if (key === 'SLACK_BOT_TOKEN') return process.env.SLACK_BOT_TOKEN;
      if (key === 'APP_BASE_URL') return process.env.APP_BASE_URL || 'http://localhost:3000';
      return defaultValue;
    },
  } as ConfigService;

  const mockSystemOwnerService = {} as SystemOwnerService;

  const adapter = new SlackNotificationAdapter(configService as any, mockSystemOwnerService);

  console.log('📤 Sending notification...\n');
  const context: NotificationContext = {
    request: mockRequest,
    action: 'request',
    link: 'http://localhost:3000/dashboard.html#approvals',
  };

  await adapter.notifyManager(context);
  console.log('\n✅ Notification test complete! Check Slack for message.\n');

  await dataSource.destroy();
}

testNotificationFlow().catch(console.error);

