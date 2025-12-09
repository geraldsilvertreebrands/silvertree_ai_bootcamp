import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AccessGrant, AccessGrantStatus } from '../entities/access-grant.entity';
import { User } from '../../identity/entities/user.entity';
import { SystemInstance } from '../../systems/entities/system-instance.entity';
import { AccessTier } from '../../systems/entities/access-tier.entity';
import { CreateAccessGrantDto } from '../dto/create-access-grant.dto';
import { UpdateAccessGrantStatusDto } from '../dto/update-access-grant-status.dto';
import { BulkCreateAccessGrantsDto } from '../dto/bulk-create-access-grants.dto';
import { SystemOwnerService } from '../../ownership/services/system-owner.service';
import { CsvParserService, ParsedCsvGrant } from './csv-parser.service';

@Injectable()
export class AccessGrantService {
  constructor(
    @InjectRepository(AccessGrant)
    private accessGrantRepository: Repository<AccessGrant>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(SystemInstance)
    private systemInstanceRepository: Repository<SystemInstance>,
    @InjectRepository(AccessTier)
    private accessTierRepository: Repository<AccessTier>,
    private systemOwnerService: SystemOwnerService,
    private csvParserService: CsvParserService,
  ) {}

  async create(createAccessGrantDto: CreateAccessGrantDto): Promise<AccessGrant> {
    const { userId, systemInstanceId, accessTierId, grantedById, grantedAt, status } =
      createAccessGrantDto;

    // Validate user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Validate system instance exists and load system
    const systemInstance = await this.systemInstanceRepository.findOne({
      where: { id: systemInstanceId },
      relations: ['system'],
    });
    if (!systemInstance) {
      throw new NotFoundException(`SystemInstance with ID ${systemInstanceId} not found`);
    }

    // Validate access tier exists and load system
    const accessTier = await this.accessTierRepository.findOne({
      where: { id: accessTierId },
      relations: ['system'],
    });
    if (!accessTier) {
      throw new NotFoundException(`AccessTier with ID ${accessTierId} not found`);
    }

    // Validate tier belongs to the same system as instance
    if (accessTier.systemId !== systemInstance.systemId) {
      throw new UnprocessableEntityException(
        `Access tier '${accessTier.name}' does not belong to system '${systemInstance.system.name}'`,
      );
    }

    // Validate grantedBy user exists if provided
    if (grantedById) {
      const grantedByUser = await this.userRepository.findOne({ where: { id: grantedById } });
      if (!grantedByUser) {
        throw new NotFoundException(`GrantedBy User with ID ${grantedById} not found`);
      }
    }

    // Set defaults
    const grantStatus = status || AccessGrantStatus.ACTIVE;
    const grantedAtDate = grantedAt ? new Date(grantedAt) : new Date();

    // Check for duplicate active grant (only if creating active grant)
    if (grantStatus === AccessGrantStatus.ACTIVE) {
      const existingGrant = await this.accessGrantRepository.findOne({
        where: {
          userId,
          systemInstanceId,
          accessTierId,
          status: AccessGrantStatus.ACTIVE,
        },
      });

      if (existingGrant) {
        throw new ConflictException(
          `Active grant already exists for user '${user.name}' on instance '${systemInstance.name}' with tier '${accessTier.name}'`,
        );
      }
    }

    // Create grant
    const grant = this.accessGrantRepository.create({
      userId,
      systemInstanceId,
      accessTierId,
      grantedById: grantedById || null,
      grantedAt: grantedAtDate,
      status: grantStatus,
      removedAt: grantStatus === AccessGrantStatus.REMOVED ? new Date() : null,
    });

    const savedGrant = await this.accessGrantRepository.save(grant);

    // Load all relations for response
    const fullGrant = await this.accessGrantRepository.findOne({
      where: { id: savedGrant.id },
      relations: ['user', 'systemInstance', 'systemInstance.system', 'accessTier', 'grantedBy'],
    });

    if (!fullGrant) {
      throw new NotFoundException(`AccessGrant with ID ${savedGrant.id} not found after save`);
    }

    return fullGrant;
  }

  async updateStatus(
    id: string,
    updateStatusDto: UpdateAccessGrantStatusDto,
  ): Promise<AccessGrant> {
    const { status } = updateStatusDto;

    // Find existing grant
    const grant = await this.accessGrantRepository.findOne({
      where: { id },
    });

    if (!grant) {
      throw new NotFoundException(`AccessGrant with ID ${id} not found`);
    }

    // Update status
    grant.status = status;

    // Set or clear removedAt based on status
    if (status === AccessGrantStatus.REMOVED) {
      grant.removedAt = new Date();
    } else if (status === AccessGrantStatus.ACTIVE) {
      grant.removedAt = null;
    } else if (status === AccessGrantStatus.TO_REMOVE) {
      // Do not mark removed, but ensure removedAt is cleared
      grant.removedAt = null;
    }

    // Save updated grant
    await this.accessGrantRepository.save(grant);

    // Load all relations for response
    const fullGrant = await this.accessGrantRepository.findOne({
      where: { id },
      relations: ['user', 'systemInstance', 'systemInstance.system', 'accessTier', 'grantedBy'],
    });

    if (!fullGrant) {
      throw new NotFoundException(`AccessGrant with ID ${id} not found after update`);
    }

    return fullGrant;
  }

  async bulkCreate(
    bulkCreateDto: BulkCreateAccessGrantsDto,
    grantedById?: string,
  ): Promise<{
    success: number;
    failed: number;
    skipped: number;
    results: Array<{
      row: number;
      success: boolean;
      grant?: AccessGrant;
      error?: string;
      skipped?: boolean;
    }>;
  }> {
    const { grants } = bulkCreateDto;
    const results: Array<{
      row: number;
      success: boolean;
      grant?: AccessGrant;
      error?: string;
      skipped?: boolean;
    }> = [];

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // Process each grant individually (best-effort approach)
    for (let i = 0; i < grants.length; i++) {
      const grantDto = grants[i];
      const row = i + 1; // 1-indexed for user-friendly error messages

      try {
        // Check for duplicate active grant first (before validation)
        if (grantDto.status === AccessGrantStatus.ACTIVE || !grantDto.status) {
          const existingGrant = await this.accessGrantRepository.findOne({
            where: {
              userId: grantDto.userId,
              systemInstanceId: grantDto.systemInstanceId,
              accessTierId: grantDto.accessTierId,
              status: AccessGrantStatus.ACTIVE,
            },
          });

          if (existingGrant) {
            results.push({
              row,
              success: false,
              skipped: true,
              error: 'Duplicate active grant already exists',
            });
            skippedCount++;
            continue;
          }
        }

        // Set grantedById if provided
        // Convert to CreateAccessGrantDto format (service method doesn't use ValidationPipe)
        const grantWithGrantedBy: CreateAccessGrantDto = {
          userId: grantDto.userId,
          systemInstanceId: grantDto.systemInstanceId,
          accessTierId: grantDto.accessTierId,
          grantedById: grantedById || grantDto.grantedById,
          grantedAt: grantDto.grantedAt,
          status: grantDto.status,
        };

        // Create grant using existing create method
        // Invalid UUIDs will be caught here and return detailed error messages
        const grant = await this.create(grantWithGrantedBy);

        results.push({
          row,
          success: true,
          grant,
        });
        successCount++;
      } catch (error) {
        // Extract error message
        const errorMessage =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : 'Unknown error';

        results.push({
          row,
          success: false,
          error: errorMessage,
        });
        failedCount++;
      }
    }

    return {
      success: successCount,
      failed: failedCount,
      skipped: skippedCount,
      results,
    };
  }

  async bulkCreateFromCsv(
    csvGrants: ParsedCsvGrant[],
    grantedById?: string,
  ): Promise<{
    success: number;
    failed: number;
    skipped: number;
    results: Array<{
      row: number;
      success: boolean;
      grant?: AccessGrant;
      error?: string;
      skipped?: boolean;
    }>;
  }> {
    const results: Array<{
      row: number;
      success: boolean;
      grant?: AccessGrant;
      error?: string;
      skipped?: boolean;
    }> = [];

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // Process each CSV grant
    for (const csvGrant of csvGrants) {
      // If there are validation errors, mark as failed
      if (csvGrant.errors && csvGrant.errors.length > 0) {
        results.push({
          row: csvGrant.row,
          success: false,
          error: csvGrant.errors.join('; '),
        });
        failedCount++;
        continue;
      }

      try {
        // Ensure user exists (create if missing)
        let userId = csvGrant.userId;
        if (!userId) {
          const email = csvGrant.userEmail.trim().toLowerCase();
          let user = await this.userRepository.findOne({ where: { email }, withDeleted: true });
          if (user?.deletedAt) {
            await this.userRepository.recover(user);
          }
          if (!user) {
            const name = csvGrant.newUserName || this.deriveNameFromEmail(email);
            try {
              user = await this.userRepository.save(
                this.userRepository.create({
                  email,
                  name,
                }),
              );
            } catch (err) {
              // Handle race condition or leftover record gracefully
              if (err instanceof QueryFailedError) {
                const existing = await this.userRepository.findOne({ where: { email }, withDeleted: true });
                if (existing) {
                  if (existing.deletedAt) {
                    await this.userRepository.recover(existing);
                  }
                  user = existing;
                } else {
                  throw err;
                }
              } else {
                throw err;
              }
            }
          }
          userId = user.id;
        }

        if (!userId) {
          throw new Error(`Failed to resolve user for row ${csvGrant.row}: ${csvGrant.userEmail}`);
        }

        // Check for duplicate active grant
        if (!csvGrant.status || csvGrant.status.toLowerCase() === 'active') {
          const existingGrant = await this.accessGrantRepository.findOne({
            where: {
              userId,
              systemInstanceId: csvGrant.systemInstanceId!,
              accessTierId: csvGrant.accessTierId!,
              status: AccessGrantStatus.ACTIVE,
            },
          });

          if (existingGrant) {
            results.push({
              row: csvGrant.row,
              success: false,
              skipped: true,
              error: 'Duplicate active grant already exists',
            });
            skippedCount++;
            continue;
          }
        }

        // Create grant
        const grantDto: CreateAccessGrantDto = {
          userId,
          systemInstanceId: csvGrant.systemInstanceId!,
          accessTierId: csvGrant.accessTierId!,
          grantedById: grantedById,
          grantedAt: csvGrant.grantedAt,
          status:
            csvGrant.status?.toLowerCase() === 'removed'
              ? AccessGrantStatus.REMOVED
              : AccessGrantStatus.ACTIVE,
        };

        const grant = await this.create(grantDto);

        // Load grant with all relations for response
        const fullGrant = await this.accessGrantRepository.findOne({
          where: { id: grant.id },
          relations: ['user', 'systemInstance', 'systemInstance.system', 'accessTier', 'grantedBy'],
        });

        results.push({
          row: csvGrant.row,
          success: true,
          grant: fullGrant || grant,
        });
        successCount++;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : 'Unknown error';

        results.push({
          row: csvGrant.row,
          success: false,
          error: errorMessage,
        });
        failedCount++;
      }
    }

    return {
      success: successCount,
      failed: failedCount,
      skipped: skippedCount,
      results,
    };
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
}

