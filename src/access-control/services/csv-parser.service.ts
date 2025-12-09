import { Injectable, BadRequestException } from '@nestjs/common';
import * as Papa from 'papaparse';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../identity/entities/user.entity';
import { System } from '../../systems/entities/system.entity';
import { SystemInstance } from '../../systems/entities/system-instance.entity';
import { AccessTier } from '../../systems/entities/access-tier.entity';

export interface CsvGrantRow {
  userEmail: string;
  systemName: string;
  instanceName: string;
  tierName: string;
  status?: string;
  grantedAt?: string;
}

export interface ParsedCsvGrant {
  row: number;
  userEmail: string;
  systemName: string;
  instanceName: string;
  tierName: string;
  status?: string;
  grantedAt?: string;
  userId?: string;
  systemInstanceId?: string;
  accessTierId?: string;
  newUserName?: string;
  errors?: string[];
}

@Injectable()
export class CsvParserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(System)
    private systemRepository: Repository<System>,
    @InjectRepository(SystemInstance)
    private systemInstanceRepository: Repository<SystemInstance>,
    @InjectRepository(AccessTier)
    private accessTierRepository: Repository<AccessTier>,
  ) {}

  /**
   * Parse CSV file content and validate structure
   */
  parseCsvFile(fileContent: string): CsvGrantRow[] {
    const result = Papa.parse<CsvGrantRow>(fileContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => {
        // Normalize header names (case-insensitive, handle spaces/underscores)
        const normalized = header.trim().toLowerCase().replace(/[\s_]/g, '');
        const headerMap: Record<string, string> = {
          useremail: 'userEmail',
          'user-email': 'userEmail',
          'user_email': 'userEmail',
          email: 'userEmail',
          systemname: 'systemName',
          'system-name': 'systemName',
          'system_name': 'systemName',
          system: 'systemName',
          instancename: 'instanceName',
          'instance-name': 'instanceName',
          'instance_name': 'instanceName',
          instance: 'instanceName',
          tiername: 'tierName',
          'tier-name': 'tierName',
          'tier_name': 'tierName',
          tier: 'tierName',
          'access-tier': 'tierName',
          'access_tier': 'tierName',
          accesstier: 'tierName',
          status: 'status',
          grantedat: 'grantedAt',
          'granted-at': 'grantedAt',
          'granted_at': 'grantedAt',
          'granteddate': 'grantedAt',
        };
        return headerMap[normalized] || header;
      },
    });

    if (result.errors.length > 0) {
      const errorMessages = result.errors.map((e) => `Row ${e.row}: ${e.message}`).join('; ');
      throw new BadRequestException(`CSV parsing errors: ${errorMessages}`);
    }

    // Validate required columns
    const requiredColumns = ['userEmail', 'systemName', 'instanceName', 'tierName'];
    const headers = result.meta.fields || [];
    const missingColumns = requiredColumns.filter((col) => !headers.includes(col));

    if (missingColumns.length > 0) {
      throw new BadRequestException(
        `Missing required columns: ${missingColumns.join(', ')}. Found columns: ${headers.join(', ')}`,
      );
    }

    return result.data;
  }

  /**
   * Validate and resolve CSV rows to grant DTOs
   * Returns array with resolved IDs and any validation errors
   */
  async validateAndResolveCsvGrants(
    csvRows: CsvGrantRow[],
  ): Promise<{ valid: ParsedCsvGrant[]; invalid: ParsedCsvGrant[] }> {
    const valid: ParsedCsvGrant[] = [];
    const invalid: ParsedCsvGrant[] = [];

    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];
      const rowNumber = i + 2; // +2 because CSV has header row and 0-indexed
      const errors: string[] = [];

      // Validate required fields
      if (!row.userEmail || !row.userEmail.trim()) {
        errors.push('User email is required');
      }
      if (!row.systemName || !row.systemName.trim()) {
        errors.push('System name is required');
      }
      if (!row.instanceName || !row.instanceName.trim()) {
        errors.push('Instance name is required');
      }
      if (!row.tierName || !row.tierName.trim()) {
        errors.push('Access tier name is required');
      }

      if (errors.length > 0) {
        invalid.push({
          row: rowNumber,
          ...row,
          errors,
        });
        continue;
      }

      // Resolve user (if not found, allow creation downstream)
      const user = await this.userRepository.findOne({
        where: { email: row.userEmail.trim().toLowerCase() },
      });
      const newUserName = user ? undefined : this.deriveNameFromEmail(row.userEmail.trim());

      // Resolve system
      const system = await this.systemRepository.findOne({
        where: { name: row.systemName.trim() },
      });
      if (!system) {
        errors.push(`System not found: ${row.systemName}`);
      }

      // Resolve instance (if system found)
      let systemInstance: SystemInstance | null = null;
      if (system) {
        systemInstance = await this.systemInstanceRepository.findOne({
          where: {
            systemId: system.id,
            name: row.instanceName.trim(),
          },
        });
        if (!systemInstance) {
          errors.push(`Instance '${row.instanceName}' not found for system '${row.systemName}'`);
        }
      }

      // Resolve access tier (if system found)
      let accessTier: AccessTier | null = null;
      if (system) {
        accessTier = await this.accessTierRepository.findOne({
          where: {
            systemId: system.id,
            name: row.tierName.trim(),
          },
        });
        if (!accessTier) {
          errors.push(`Access tier '${row.tierName}' not found for system '${row.systemName}'`);
        }
      }

      const parsedGrant: ParsedCsvGrant = {
        row: rowNumber,
        userEmail: row.userEmail.trim(),
        systemName: row.systemName.trim(),
        instanceName: row.instanceName.trim(),
        tierName: row.tierName.trim(),
        status: row.status?.trim(),
        grantedAt: row.grantedAt?.trim(),
        userId: user?.id,
        systemInstanceId: systemInstance?.id,
        accessTierId: accessTier?.id,
        newUserName,
        errors: errors.length > 0 ? errors : undefined,
      };

      if (errors.length > 0) {
        invalid.push(parsedGrant);
      } else {
        valid.push(parsedGrant);
      }
    }

    return { valid, invalid };
  }

  private deriveNameFromEmail(email: string): string {
    const localPart = email.split('@')[0] || 'New User';
    const friendly = localPart
      .split(/[.\-_]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    return friendly || 'New User';
  }

  /**
   * Generate CSV template content
   */
  generateCsvTemplate(): string {
    const rows = [
      ['userEmail', 'systemName', 'instanceName', 'tierName', 'status', 'grantedAt'],
      [
        'elokusa.zondi@silvertreebrands.com',
        'Magento',
        'UCOOK Production',
        'Admin',
        'active',
        '2024-01-01',
      ],
      [
        'tarak.pema@silvertreebrands.com',
        'Acumatica',
        'Production',
        'Admin',
        'active',
        '2024-01-02',
      ],
    ];

    return Papa.unparse(rows);
  }
}

