import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DeepLinkHelper {
  private readonly baseUrl: string;

  constructor(configService: ConfigService) {
    // FRONTEND_URL for the React app (default to Vite dev server)
    // Falls back to APP_BASE_URL for backwards compatibility
    this.baseUrl = configService.get<string>('FRONTEND_URL')
      || configService.get<string>('APP_BASE_URL', 'http://localhost:5173');
  }

  approvalLink(requestId: string): string {
    return `${this.baseUrl}/#approvals`;
  }

  pendingProvisioningLink(): string {
    return `${this.baseUrl}/#provisioning`;
  }

  pendingRemovalLink(): string {
    return `${this.baseUrl}/#removal`;
  }

  requestDetailsLink(requestId: string): string {
    return `${this.baseUrl}/#my-access`;
  }
}



