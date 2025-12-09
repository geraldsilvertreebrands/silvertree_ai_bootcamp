import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AccessRequest,
  AccessRequestItem,
  AccessRequestItemStatus,
  AccessRequestStatus,
} from '../entities/access-request.entity';
import { User } from '../../identity/entities/user.entity';
import { SystemInstance } from '../../systems/entities/system-instance.entity';
import { AccessTier } from '../../systems/entities/access-tier.entity';
import { AccessGrantService } from './access-grant.service';
import { CreateAccessRequestDto } from '../dto/create-access-request.dto';
import { AccessGrantStatus } from '../entities/access-grant.entity';
import { SystemOwnerService } from '../../ownership/services/system-owner.service';

@Injectable()
export class AccessRequestService {
  constructor(
    @InjectRepository(AccessRequest)
    private readonly accessRequestRepository: Repository<AccessRequest>,
    @InjectRepository(AccessRequestItem)
    private readonly accessRequestItemRepository: Repository<AccessRequestItem>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SystemInstance)
    private readonly systemInstanceRepository: Repository<SystemInstance>,
    @InjectRepository(AccessTier)
    private readonly accessTierRepository: Repository<AccessTier>,
    private readonly accessGrantService: AccessGrantService,
    private readonly systemOwnerService: SystemOwnerService,
  ) {}

  async create(
    dto: CreateAccessRequestDto,
    requesterId: string,
  ): Promise<AccessRequest & { items: AccessRequestItem[] }> {
    // Validate target user
    const targetUser = await this.userRepository.findOne({ where: { id: dto.targetUserId } });
    if (!targetUser) {
      throw new NotFoundException(`Target user ${dto.targetUserId} not found`);
    }

    // Validate requester
    const requester = await this.userRepository.findOne({ where: { id: requesterId } });
    if (!requester) {
      throw new NotFoundException(`Requester ${requesterId} not found`);
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one request item is required');
    }

    // Resolve instances and tiers upfront; ensure they belong together
    const resolvedItems = [];
    for (const item of dto.items) {
      const instance = await this.systemInstanceRepository.findOne({
        where: { id: item.systemInstanceId },
        relations: ['system'],
      });
      if (!instance) {
        throw new NotFoundException(`SystemInstance ${item.systemInstanceId} not found`);
      }
      const tier = await this.accessTierRepository.findOne({
        where: { id: item.accessTierId },
        relations: ['system'],
      });
      if (!tier) {
        throw new NotFoundException(`AccessTier ${item.accessTierId} not found`);
      }
      if (tier.systemId !== instance.systemId) {
        throw new ConflictException(
          `Access tier '${tier.name}' does not belong to system '${instance.system?.name}'`,
        );
      }
      resolvedItems.push({ instance, tier });
    }

    const isManager = targetUser.managerId === requesterId;
    const requestStatus = isManager ? AccessRequestStatus.APPROVED : AccessRequestStatus.REQUESTED;
    const itemStatus = isManager ? AccessRequestItemStatus.APPROVED : AccessRequestItemStatus.REQUESTED;

    // Create request
    const request = this.accessRequestRepository.create({
      targetUserId: dto.targetUserId,
      requesterId,
      note: dto.note || null,
      status: requestStatus,
    });
    const savedRequest = await this.accessRequestRepository.save(request);

    const savedItems: AccessRequestItem[] = [];

    for (let i = 0; i < dto.items.length; i++) {
      const input = dto.items[i];
      const { instance, tier } = resolvedItems[i];

      const item = this.accessRequestItemRepository.create({
        accessRequestId: savedRequest.id,
        systemInstanceId: instance.id,
        accessTierId: tier.id,
        status: itemStatus,
      });
      const savedItem = await this.accessRequestItemRepository.save(item);
      savedItems.push(savedItem);

      // Auto-approve path: create grants (best effort with duplicate check inside grant service)
      if (isManager) {
        try {
          await this.accessGrantService.create({
            userId: dto.targetUserId,
            systemInstanceId: instance.id,
            accessTierId: tier.id,
            grantedById: requesterId,
            status: AccessGrantStatus.ACTIVE,
          });
        } catch (err) {
          // If duplicate, skip creating another grant but keep request approved
          if (err instanceof ConflictException) {
            // No-op: grant already exists
          } else {
            throw err;
          }
        }
      }
    }

    const fullRequest = await this.accessRequestRepository.findOne({
      where: { id: savedRequest.id },
      relations: [
        'items',
        'items.systemInstance',
        'items.systemInstance.system',
        'items.accessTier',
        'requester',
        'targetUser',
      ],
    });

    if (!fullRequest) {
      throw new NotFoundException(`AccessRequest ${savedRequest.id} not found after create`);
    }

    (fullRequest as any).items = savedItems;
    return fullRequest as AccessRequest & { items: AccessRequestItem[] };
  }

  async approveRequest(requestId: string, approverId: string): Promise<AccessRequest & { items: AccessRequestItem[] }> {
    const request = await this.accessRequestRepository.findOne({
      where: { id: requestId },
      relations: ['items', 'items.systemInstance', 'items.systemInstance.system', 'items.accessTier'],
    });

    if (!request) {
      throw new NotFoundException(`AccessRequest ${requestId} not found`);
    }

    // Check authorization: approver must be system owner for all items
    for (const item of request.items) {
      if (item.status === AccessRequestItemStatus.APPROVED) {
        continue; // Skip already approved items
      }
      const isOwner = await this.systemOwnerService.isSystemOwner(approverId, item.systemInstance.systemId);
      if (!isOwner) {
        throw new ForbiddenException(
          `You are not authorized to approve requests for system '${item.systemInstance.system.name}'. You must be a system owner.`,
        );
      }
    }

    // Approve all approvable items and create grants
    for (const item of request.items) {
      if (item.status === AccessRequestItemStatus.APPROVED) {
        continue;
      }
      item.status = AccessRequestItemStatus.APPROVED;
      await this.accessRequestItemRepository.save(item);

      // Create grant (best effort - skip if duplicate)
      try {
        const grant = await this.accessGrantService.create({
          userId: request.targetUserId,
          systemInstanceId: item.systemInstanceId,
          accessTierId: item.accessTierId,
          grantedById: approverId,
          status: AccessGrantStatus.ACTIVE,
        });
        item.accessGrantId = grant.id;
        await this.accessRequestItemRepository.save(item);
      } catch (err) {
        if (err instanceof ConflictException) {
          // Grant already exists, skip
        } else {
          throw err;
        }
      }
    }

    // Update request status if all items approved
    const allApproved = request.items.every((i) => i.status === AccessRequestItemStatus.APPROVED);
    if (allApproved) {
      request.status = AccessRequestStatus.APPROVED;
      await this.accessRequestRepository.save(request);
    }

    return await this.loadRequestWithItems(requestId);
  }

  async rejectRequest(requestId: string, rejectorId: string): Promise<AccessRequest & { items: AccessRequestItem[] }> {
    const request = await this.accessRequestRepository.findOne({
      where: { id: requestId },
      relations: ['items', 'items.systemInstance', 'items.systemInstance.system'],
    });

    if (!request) {
      throw new NotFoundException(`AccessRequest ${requestId} not found`);
    }

    // Check authorization: rejector must be system owner for all items
    for (const item of request.items) {
      if (item.status === AccessRequestItemStatus.REJECTED) {
        continue;
      }
      const isOwner = await this.systemOwnerService.isSystemOwner(rejectorId, item.systemInstance.systemId);
      if (!isOwner) {
        throw new ForbiddenException(
          `You are not authorized to reject requests for system '${item.systemInstance.system.name}'. You must be a system owner.`,
        );
      }
    }

    // Reject all rejectable items
    for (const item of request.items) {
      if (item.status === AccessRequestItemStatus.REJECTED) {
        continue;
      }
      item.status = AccessRequestItemStatus.REJECTED;
      await this.accessRequestItemRepository.save(item);
    }

    request.status = AccessRequestStatus.REJECTED;
    await this.accessRequestRepository.save(request);

    return await this.loadRequestWithItems(requestId);
  }

  async approveItem(itemId: string, approverId: string): Promise<AccessRequestItem> {
    const item = await this.accessRequestItemRepository.findOne({
      where: { id: itemId },
      relations: ['accessRequest', 'systemInstance', 'systemInstance.system', 'accessTier'],
    });

    if (!item) {
      throw new NotFoundException(`AccessRequestItem ${itemId} not found`);
    }

    if (item.status === AccessRequestItemStatus.APPROVED) {
      return item; // Already approved
    }

    // Check authorization
    const isOwner = await this.systemOwnerService.isSystemOwner(approverId, item.systemInstance.systemId);
    if (!isOwner) {
      throw new ForbiddenException(
        `You are not authorized to approve items for system '${item.systemInstance.system.name}'. You must be a system owner.`,
      );
    }

    item.status = AccessRequestItemStatus.APPROVED;
    await this.accessRequestItemRepository.save(item);

    // Create grant (best effort - skip if duplicate)
    try {
      const grant = await this.accessGrantService.create({
        userId: item.accessRequest.targetUserId,
        systemInstanceId: item.systemInstanceId,
        accessTierId: item.accessTierId,
        grantedById: approverId,
        status: AccessGrantStatus.ACTIVE,
      });
      item.accessGrantId = grant.id;
      await this.accessRequestItemRepository.save(item);
    } catch (err) {
      if (err instanceof ConflictException) {
        // Grant already exists, skip
      } else {
        throw err;
      }
    }

    // Update request status if all items approved
    const request = await this.accessRequestRepository.findOne({
      where: { id: item.accessRequestId },
      relations: ['items'],
    });
    if (request) {
      const allApproved = request.items.every((i) => i.status === AccessRequestItemStatus.APPROVED);
      if (allApproved) {
        request.status = AccessRequestStatus.APPROVED;
        await this.accessRequestRepository.save(request);
      }
    }

    return await this.accessRequestItemRepository.findOne({
      where: { id: itemId },
      relations: ['systemInstance', 'systemInstance.system', 'accessTier'],
    }) as AccessRequestItem;
  }

  async rejectItem(itemId: string, rejectorId: string, note?: string): Promise<AccessRequestItem> {
    const item = await this.accessRequestItemRepository.findOne({
      where: { id: itemId },
      relations: ['accessRequest', 'systemInstance', 'systemInstance.system', 'accessTier'],
    });

    if (!item) {
      throw new NotFoundException(`AccessRequestItem ${itemId} not found`);
    }

    if (item.status === AccessRequestItemStatus.REJECTED) {
      return item; // Already rejected
    }

    // Check authorization
    const isOwner = await this.systemOwnerService.isSystemOwner(rejectorId, item.systemInstance.systemId);
    if (!isOwner) {
      throw new ForbiddenException(
        `You are not authorized to reject items for system '${item.systemInstance.system.name}'. You must be a system owner.`,
      );
    }

    item.status = AccessRequestItemStatus.REJECTED;
    await this.accessRequestItemRepository.save(item);

    // Update request note if provided
    if (note) {
      const request = await this.accessRequestRepository.findOne({
        where: { id: item.accessRequestId },
      });
      if (request) {
        request.note = note;
        await this.accessRequestRepository.save(request);
      }
    }

    // Update request status if all items rejected
    const request = await this.accessRequestRepository.findOne({
      where: { id: item.accessRequestId },
      relations: ['items'],
    });
    if (request) {
      const allRejected = request.items.every((i) => i.status === AccessRequestItemStatus.REJECTED);
      const hasApproved = request.items.some((i) => i.status === AccessRequestItemStatus.APPROVED);
      if (allRejected && !hasApproved) {
        request.status = AccessRequestStatus.REJECTED;
        await this.accessRequestRepository.save(request);
      }
    }

    return await this.accessRequestItemRepository.findOne({
      where: { id: itemId },
      relations: ['systemInstance', 'systemInstance.system', 'accessTier'],
    }) as AccessRequestItem;
  }

  async findAllForUser(userId: string, status?: AccessRequestStatus): Promise<AccessRequest[]> {
    const query = this.accessRequestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.items', 'items')
      .leftJoinAndSelect('items.systemInstance', 'systemInstance')
      .leftJoinAndSelect('systemInstance.system', 'system')
      .leftJoinAndSelect('items.accessTier', 'accessTier')
      .leftJoinAndSelect('request.requester', 'requester')
      .leftJoinAndSelect('request.targetUser', 'targetUser')
      .where('(request.requesterId = :userId OR request.targetUserId = :userId)', { userId })
      .orderBy('request.createdAt', 'DESC');

    if (status) {
      query.andWhere('request.status = :status', { status });
    }

    return query.getMany();
  }

  async findAllForSystemOwner(systemOwnerId: string, status?: AccessRequestStatus): Promise<AccessRequest[]> {
    // Get all systems owned by this user
    const ownedSystems = await this.systemOwnerService.findByUser(systemOwnerId);
    const systemIds = ownedSystems.map(so => so.systemId);

    if (systemIds.length === 0) {
      return []; // No systems owned, no requests to show
    }

    // Find all requests that have items for systems owned by this user
    const query = this.accessRequestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.items', 'items')
      .leftJoinAndSelect('items.systemInstance', 'systemInstance')
      .leftJoinAndSelect('systemInstance.system', 'system')
      .leftJoinAndSelect('items.accessTier', 'accessTier')
      .leftJoinAndSelect('request.requester', 'requester')
      .leftJoinAndSelect('request.targetUser', 'targetUser')
      .where('systemInstance.systemId IN (:...systemIds)', { systemIds })
      .orderBy('request.createdAt', 'DESC');

    if (status) {
      query.andWhere('request.status = :status', { status });
    }

    const requests = await query.getMany();

    // Filter to only include requests with at least one item for owned systems
    return requests.filter(request => 
      request.items.some(item => systemIds.includes(item.systemInstance.systemId))
    );
  }

  private async loadRequestWithItems(requestId: string): Promise<AccessRequest & { items: AccessRequestItem[] }> {
    const request = await this.accessRequestRepository.findOne({
      where: { id: requestId },
      relations: ['items', 'items.systemInstance', 'items.systemInstance.system', 'items.accessTier'],
    });

    if (!request) {
      throw new NotFoundException(`AccessRequest ${requestId} not found`);
    }

    return request as AccessRequest & { items: AccessRequestItem[] };
  }
}

