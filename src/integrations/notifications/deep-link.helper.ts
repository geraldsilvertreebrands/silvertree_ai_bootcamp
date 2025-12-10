import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DeepLinkHelper {
  private readonly baseUrl: string;

  constructor(configService: ConfigService) {
    this.baseUrl = configService.get<string>('APP_BASE_URL', 'http://localhost:3000');
  }

  approvalLink(requestId: string): string {
    return `${this.baseUrl}/dashboard.html#approvals`;
  }

  pendingProvisioningLink(): string {
    return `${this.baseUrl}/dashboard.html#provisioning`;
  }

  pendingRemovalLink(): string {
    return `${this.baseUrl}/dashboard.html#removal`;
  }

  requestDetailsLink(requestId: string): string {
    return `${this.baseUrl}/dashboard.html#requests`;
  }
}

