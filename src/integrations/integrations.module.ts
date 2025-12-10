import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NOTIFICATION_SERVICE } from './notifications/notification.interface';
import { MockNotificationAdapter } from './notifications/mock-notification.adapter';
import { SlackNotificationAdapter } from './notifications/slack-notification.adapter';
import { DeepLinkHelper } from './notifications/deep-link.helper';
import { OwnershipModule } from '../ownership/ownership.module';
import { SystemOwnerService } from '../ownership/services/system-owner.service';

@Module({
  imports: [ConfigModule, OwnershipModule],
  providers: [
    DeepLinkHelper,
    {
      provide: NOTIFICATION_SERVICE,
      useFactory: (
        configService: ConfigService,
        systemOwnerService: SystemOwnerService,
      ) => {
        const enableSlack = configService.get<string>('ENABLE_SLACK') === 'true';
        const slackToken = configService.get<string>('SLACK_BOT_TOKEN');

        console.log(`[IntegrationsModule] ENABLE_SLACK: ${configService.get<string>('ENABLE_SLACK')}, enableSlack: ${enableSlack}`);
        console.log(`[IntegrationsModule] SLACK_BOT_TOKEN: ${slackToken ? 'SET (' + slackToken.substring(0, 10) + '...)' : 'NOT SET'}`);

        if (enableSlack && slackToken) {
          console.log(`[IntegrationsModule] Using SlackNotificationAdapter`);
          return new SlackNotificationAdapter(configService, systemOwnerService);
        }

        console.log(`[IntegrationsModule] Using MockNotificationAdapter`);
        return new MockNotificationAdapter();
      },
      inject: [ConfigService, SystemOwnerService],
    },
  ],
  exports: [NOTIFICATION_SERVICE, DeepLinkHelper],
})
export class IntegrationsModule {}

