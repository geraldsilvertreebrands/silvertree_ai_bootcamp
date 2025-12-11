import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Inject,
  Logger,
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
import { CopyGrantsDto, CopyGrantsResult } from '../dto/copy-grants.dto';
import { AccessGrant, AccessGrantStatus } from '../entities/access-grant.entity';
import { SystemOwnerService } from '../../ownership/services/system-owner.service';
import { validateRequestTransition } from './status-transition.validator';
import { In } from 'typeorm';
import { NOTIFICATION_SERVICE, INotificationService } from '../../integrations/notifications/notification.interface';
import { DeepLinkHelper } from '../../integrations/notifications/deep-link.helper';
import { AuditLogService } from './audit-log.service';
import { AuditAction } from '../entities/audit-log.entity';

@Injectable()
export class AccessRequestService {
  private readonly logger = new Logger(AccessRequestService.name);

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
    @InjectRepository(AccessGrant)
    private readonly accessGrantRepository: Repository<AccessGrant>,
    private readonly accessGrantService: AccessGrantService,
    private readonly systemOwnerService: SystemOwnerService,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notificationService: INotificationService,
    private readonly deepLinkHelper: DeepLinkHelper,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    dto: CreateAccessRequestDto,
    requesterId: string,
  ): Promise<AccessRequest & { items: AccessRequestItem[] }> {
    // Validate target user (load with manager relation to check managerId)
    const targetUser = await this.userRepository.findOne({ 
      where: { id: dto.targetUserId },
      relations: ['manager'], // Load manager to ensure managerId is available
    });
    if (!targetUser) {
      throw new NotFoundException(`Target user ${dto.targetUserId} not found`);
    }
    
    this.logger.log(`[AccessRequestService] Target user loaded: ${targetUser.email}, managerId: ${targetUser.managerId}, requesterId: ${requesterId}, dto.targetUserId: ${dto.targetUserId}`);

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

    // Only auto-approve if requester is manager AND requester is NOT the target user
    // (self-requests should always go through approval flow)
    // IMPORTANT: If requester === target user, NEVER auto-approve, even if they're their own manager
    const isSelfRequest = requesterId === dto.targetUserId;
    const isManager = !isSelfRequest && targetUser.managerId === requesterId;
    
    this.logger.log(`[AccessRequestService] Checking auto-approval:`);
    this.logger.log(`  - targetUser.managerId=${targetUser.managerId}`);
    this.logger.log(`  - requesterId=${requesterId}`);
    this.logger.log(`  - dto.targetUserId=${dto.targetUserId}`);
    this.logger.log(`  - isSelfRequest=${isSelfRequest}`);
    this.logger.log(`  - isManager=${isManager}`);
    this.logger.log(`  - Will be: ${isManager ? 'APPROVED' : 'REQUESTED'}`);
    
    // FORCE REQUESTED status for self-requests, regardless of manager relationship
    const requestStatus = isSelfRequest ? AccessRequestStatus.REQUESTED : (isManager ? AccessRequestStatus.APPROVED : AccessRequestStatus.REQUESTED);
    const itemStatus = isSelfRequest ? AccessRequestItemStatus.REQUESTED : (isManager ? AccessRequestItemStatus.APPROVED : AccessRequestItemStatus.REQUESTED);
    
    this.logger.log(`[AccessRequestService] Final status decision: requestStatus=${requestStatus}, itemStatus=${itemStatus}`);

    // Create request
    const request = this.accessRequestRepository.create({
      targetUserId: dto.targetUserId,
      requesterId,
      note: dto.note || null,
      status: requestStatus,
    });
    const savedRequest = await this.accessRequestRepository.save(request);
    this.logger.log(`[AccessRequestService] Saved request ${savedRequest.id} with status: ${savedRequest.status}`);

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
      // ONLY create grants if this is NOT a self-request
      if (isManager && !isSelfRequest) {
        try {
          await this.accessGrantService.create({
            userId: dto.targetUserId,
            systemInstanceId: instance.id,
            accessTierId: tier.id,
            grantedById: requesterId,
            status: AccessGrantStatus.ACTIVE,
          });
          this.logger.log(`[AccessRequestService] Created grant for auto-approved request item ${savedItem.id}`);
        } catch (err) {
          // If duplicate, skip creating another grant but keep request approved
          if (err instanceof ConflictException) {
            // No-op: grant already exists
          } else {
            throw err;
          }
        }
      } else {
        this.logger.log(`[AccessRequestService] NOT creating grant for item ${savedItem.id} (isManager=${isManager}, isSelfRequest=${isSelfRequest})`);
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
        'targetUser.manager', // Load manager relation for notifications
      ],
    });

    if (!fullRequest) {
      throw new NotFoundException(`AccessRequest ${savedRequest.id} not found after create`);
    }

    // Note: fullRequest.items already has the relations loaded from the query above
    // Don't override with savedItems as that would lose the relations

    // NOTIFICATION FLOW:
    // 1. Request created → Notify SYSTEM OWNERS via Slack (they see it in Pending Provisions)
    // 2. Owner provisions/rejects → Notify REQUESTER via Slack
    try {
      this.logger.log(`[AccessRequestService] Request ${fullRequest.id} created, notifying system owners via Slack`);
      await this.notificationService.notifySystemOwners({
        request: fullRequest,
        action: 'request',
        link: this.deepLinkHelper.pendingProvisioningLink(),
      });
      this.logger.log(`[AccessRequestService] ✓ System owners notified for new request`);
    } catch (error) {
      // Don't fail the request creation if notification fails
      this.logger.error(`[AccessRequestService] ❌ Failed to notify system owners: ${error instanceof Error ? error.message : String(error)}`);
    }

    return fullRequest as AccessRequest & { items: AccessRequestItem[] };
  }

  async approveRequest(requestId: string, approverId: string): Promise<AccessRequest & { items: AccessRequestItem[] }> {
    const request = await this.accessRequestRepository.findOne({
      where: { id: requestId },
      relations: [
        'items',
        'items.systemInstance',
        'items.systemInstance.system',
        'items.accessTier',
        'targetUser',
        'targetUser.manager', // Load manager to verify they're NOT being notified
        'requester', // CRITICAL: Load requester for notifications
      ],
    });

    if (!request) {
      throw new NotFoundException(`AccessRequest ${requestId} not found`);
    }

    // Validate status transition
    validateRequestTransition(request.status, AccessRequestStatus.APPROVED);

    // Check authorization: approver must be the manager of the target user
    if (request.targetUser.managerId !== approverId) {
      throw new ForbiddenException(
        'Only the manager of the grantee can approve this request',
      );
    }

    // Approve all approvable items
    // Note: Grants are NOT created here - that happens during system owner provisioning (PHASE2-004)
    for (const item of request.items) {
      if (item.status === AccessRequestItemStatus.APPROVED) {
        continue;
      }
      item.status = AccessRequestItemStatus.APPROVED;
      await this.accessRequestItemRepository.save(item);
    }

    // Update request status if all items approved
    const allApproved = request.items.every((i) => i.status === AccessRequestItemStatus.APPROVED);
    if (allApproved) {
      request.status = AccessRequestStatus.APPROVED;
      await this.accessRequestRepository.save(request);
    }

    const updatedRequest = await this.loadRequestWithItems(requestId);

    // Log to audit
    await this.auditLogService.log({
      action: AuditAction.REQUEST_APPROVED,
      actorId: approverId,
      targetUserId: updatedRequest.targetUserId,
      resourceType: 'access_request',
      resourceId: requestId,
      details: {
        itemCount: updatedRequest.items.length,
        systems: updatedRequest.items.map(i => i.systemInstance?.system?.name).filter(Boolean),
      },
    });

    // NO notifications here - system owners were already notified when request was created
    // The ONLY notification to requester happens in provisionItem() with "Access Granted"
    this.logger.log(`[AccessRequestService] Request ${requestId} approved (no notification - happens on provision)`);

    return updatedRequest;
  }

  async rejectRequest(requestId: string, rejectorId: string, reason: string): Promise<AccessRequest & { items: AccessRequestItem[] }> {
    const request = await this.accessRequestRepository.findOne({
      where: { id: requestId },
      relations: ['items', 'items.systemInstance', 'items.systemInstance.system', 'targetUser', 'requester'],
    });

    if (!request) {
      throw new NotFoundException(`AccessRequest ${requestId} not found`);
    }

    // Validate status transition
    validateRequestTransition(request.status, AccessRequestStatus.REJECTED);

    // Check authorization: rejector must be the manager of the target user
    if (request.targetUser.managerId !== rejectorId) {
      throw new ForbiddenException(
        'Only the manager of the grantee can reject this request',
      );
    }

    // Reject all rejectable items
    for (const item of request.items) {
      if (item.status === AccessRequestItemStatus.REJECTED) {
        continue;
      }
      item.status = AccessRequestItemStatus.REJECTED;
      await this.accessRequestItemRepository.save(item);
    }

    // Update request note with rejection reason
    request.note = reason;
    request.status = AccessRequestStatus.REJECTED;
    await this.accessRequestRepository.save(request);

    const updatedRequest = await this.loadRequestWithItems(requestId);

    // Log to audit
    await this.auditLogService.log({
      action: AuditAction.REQUEST_REJECTED,
      actorId: rejectorId,
      targetUserId: updatedRequest.targetUserId,
      resourceType: 'access_request',
      resourceId: requestId,
      reason,
      details: {
        itemCount: updatedRequest.items.length,
        systems: updatedRequest.items.map(i => i.systemInstance?.system?.name).filter(Boolean),
      },
    });

    // Notify requester of rejection via Slack
    try {
      this.logger.log(`[AccessRequestService] Request ${requestId} rejected, notifying requester via Slack`);
      if (updatedRequest.requester?.email) {
        await this.notificationService.notifyRequester({
          request: updatedRequest,
          action: 'reject',
          reason,
          link: this.deepLinkHelper.requestDetailsLink(updatedRequest.id),
        });
        this.logger.log(`[AccessRequestService] ✓ Requester notified of rejection`);
      }
    } catch (error) {
      this.logger.error(`[AccessRequestService] ❌ Failed to notify requester: ${error instanceof Error ? error.message : String(error)}`);
    }

    return updatedRequest;
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

    // Log to audit
    await this.auditLogService.log({
      action: AuditAction.ITEM_APPROVED,
      actorId: approverId,
      targetUserId: item.accessRequest.targetUserId,
      resourceType: 'access_request_item',
      resourceId: itemId,
      details: {
        systemName: item.systemInstance?.system?.name,
        instanceName: item.systemInstance?.name,
        tierName: item.accessTier?.name,
      },
    });

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
      relations: ['items', 'requester', 'targetUser'],
    });
    if (request) {
      const allRejected = request.items.every((i) => i.status === AccessRequestItemStatus.REJECTED);
      const hasApproved = request.items.some((i) => i.status === AccessRequestItemStatus.APPROVED);
      if (allRejected && !hasApproved) {
        request.status = AccessRequestStatus.REJECTED;
        await this.accessRequestRepository.save(request);
      }
    }

    const updatedItem = await this.accessRequestItemRepository.findOne({
      where: { id: itemId },
      relations: [
        'accessRequest',
        'accessRequest.requester',
        'accessRequest.targetUser',
        'systemInstance',
        'systemInstance.system',
        'accessTier',
      ],
    });

    // Log to audit
    await this.auditLogService.log({
      action: AuditAction.ITEM_REJECTED,
      actorId: rejectorId,
      targetUserId: item.accessRequest.targetUserId,
      resourceType: 'access_request_item',
      resourceId: itemId,
      reason: note,
      details: {
        systemName: item.systemInstance?.system?.name,
        instanceName: item.systemInstance?.name,
        tierName: item.accessTier?.name,
      },
    });

    // Send notification to requester about rejection
    if (request && request.requester?.email) {
      try {
        await this.notificationService.notifyRequester({
          request: request,
          action: 'reject',
          reason: note || 'Rejected by system owner',
          link: this.deepLinkHelper.requestDetailsLink(request.id),
        });
        this.logger.log(`[AccessRequestService] ✓ Requester notified of rejection`);
      } catch (error) {
        this.logger.error(`[AccessRequestService] ❌ Failed to notify requester: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return updatedItem as AccessRequestItem;
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
      .leftJoinAndSelect('targetUser.manager', 'manager') // Load manager relation
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

  async findPendingForManager(managerId: string): Promise<AccessRequest[]> {
    // Find all requests where:
    // 1. Request status is REQUESTED
    // 2. Target user's managerId matches the managerId
    // 3. EXCLUDE requests where the requester is the manager themselves (no self-approval)
    return this.accessRequestRepository
      .createQueryBuilder('request')
      .innerJoinAndSelect('request.targetUser', 'targetUser')
      .leftJoinAndSelect('request.items', 'items')
      .leftJoinAndSelect('items.systemInstance', 'systemInstance')
      .leftJoinAndSelect('systemInstance.system', 'system')
      .leftJoinAndSelect('items.accessTier', 'accessTier')
      .leftJoinAndSelect('request.requester', 'requester')
      .where('request.status = :status', { status: AccessRequestStatus.REQUESTED })
      .andWhere('targetUser.managerId = :managerId', { managerId })
      .andWhere('request.requesterId != :managerId', { managerId }) // Exclude self-requests
      .orderBy('request.createdAt', 'ASC')
      .getMany();
  }

  private async loadRequestWithItems(requestId: string): Promise<AccessRequest & { items: AccessRequestItem[] }> {
    const request = await this.accessRequestRepository.findOne({
      where: { id: requestId },
      relations: [
        'items',
        'items.systemInstance',
        'items.systemInstance.system',
        'items.accessTier',
        'requester',
        'targetUser',
        'targetUser.manager', // Load manager relation for notifications
      ],
    });

    if (!request) {
      throw new NotFoundException(`AccessRequest ${requestId} not found`);
    }

    return request as AccessRequest & { items: AccessRequestItem[] };
  }

  /**
   * Find approved request items pending provisioning for systems owned by the user
   * (PHASE2-004: System Owner Provisioning)
   */
  async findPendingProvisioning(ownerId: string): Promise<AccessRequestItem[]> {
    // Get systems owned by this user
    const ownedSystems = await this.systemOwnerService.findByUser(ownerId);
    const systemIds = ownedSystems.map(o => o.systemId);

    if (systemIds.length === 0) return [];

    // Find items for owned systems that need owner action:
    // 1. REQUESTED items (need approval/rejection)
    // 2. APPROVED items that don't have grants yet (need provisioning)
    return this.accessRequestItemRepository
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.accessRequest', 'request')
      .innerJoinAndSelect('request.targetUser', 'targetUser')
      .innerJoinAndSelect('request.requester', 'requester')
      .innerJoinAndSelect('item.systemInstance', 'systemInstance')
      .innerJoinAndSelect('systemInstance.system', 'system')
      .innerJoinAndSelect('item.accessTier', 'accessTier')
      .where('system.id IN (:...systemIds)', { systemIds })
      .andWhere(
        '(item.status = :requestedStatus OR (item.status = :approvedStatus AND item.accessGrantId IS NULL))',
        {
          requestedStatus: AccessRequestItemStatus.REQUESTED,
          approvedStatus: AccessRequestItemStatus.APPROVED,
        },
      )
      .orderBy('item.createdAt', 'ASC')
      .getMany();
  }

  /**
   * Provision a request item by creating an active grant
   * For REQUESTED items: approves first, then provisions (creates grant)
   * For APPROVED items: provisions directly (creates grant)
   * (PHASE2-004: System Owner Provisioning)
   */
  async provisionItem(itemId: string, ownerId: string): Promise<AccessGrant> {
    const item = await this.accessRequestItemRepository.findOne({
      where: { id: itemId },
      relations: ['accessRequest', 'systemInstance', 'systemInstance.system', 'accessTier'],
    });

    if (!item) {
      throw new NotFoundException(`AccessRequestItem ${itemId} not found`);
    }

    // Check authorization: user must be system owner
    const isOwner = await this.systemOwnerService.isSystemOwner(ownerId, item.systemInstance.systemId);
    if (!isOwner) {
      throw new ForbiddenException(
        `You are not authorized to provision items for system '${item.systemInstance.system.name}'. You must be a system owner.`,
      );
    }

    // If item is REQUESTED, approve it first (this will create the grant automatically)
    if (item.status === AccessRequestItemStatus.REQUESTED) {
      await this.approveItem(itemId, ownerId);
      // Reload item to get the grant ID
      const updatedItem = await this.accessRequestItemRepository.findOne({
        where: { id: itemId },
        relations: ['accessRequest', 'systemInstance', 'systemInstance.system', 'accessTier'],
      });
      if (!updatedItem || !updatedItem.accessGrantId) {
        throw new BadRequestException('Failed to create grant during approval');
      }
      const grant = await this.accessGrantRepository.findOne({
        where: { id: updatedItem.accessGrantId },
        relations: ['user', 'systemInstance', 'systemInstance.system', 'accessTier', 'grantedBy'],
      });
      if (!grant) {
        throw new NotFoundException('Grant not found after approval');
      }

      // Send "Access Granted" notification to requester
      try {
        const fullRequest = await this.accessRequestRepository.findOne({
          where: { id: updatedItem.accessRequestId },
          relations: ['requester', 'targetUser', 'items', 'items.systemInstance', 'items.systemInstance.system', 'items.accessTier'],
        });
        if (fullRequest) {
          this.logger.log(`[AccessRequestService] ✓✓✓ SENDING ACCESS GRANTED NOTIFICATION to requester: ${fullRequest.requester?.email}`);
          await this.notificationService.notifyRequester({
            request: fullRequest,
            action: 'activate',
            link: this.deepLinkHelper.requestDetailsLink(fullRequest.id),
          });
          this.logger.log(`[AccessRequestService] ✓✓✓ ACCESS GRANTED NOTIFICATION SENT SUCCESSFULLY`);
        }
      } catch (error) {
        this.logger.error(`[AccessRequestService] ❌ Failed to send notification: ${error instanceof Error ? error.message : String(error)}`);
      }

      return grant;
    }

    // For APPROVED items, proceed with provisioning
    if (item.status !== AccessRequestItemStatus.APPROVED) {
      throw new BadRequestException(
        `Cannot provision item in status '${item.status}'. Only 'requested' or 'approved' items can be provisioned.`,
      );
    }

    // Check if already provisioned
    if (item.accessGrantId) {
      // Grant already exists, return it
      const existingGrant = await this.accessGrantRepository.findOne({
        where: { id: item.accessGrantId },
        relations: ['user', 'systemInstance', 'systemInstance.system', 'accessTier', 'grantedBy'],
      });
      if (existingGrant) {
        return existingGrant;
      }
    }

    // Create active grant from approved item
    try {
      const grant = await this.accessGrantService.create({
        userId: item.accessRequest.targetUserId,
        systemInstanceId: item.systemInstanceId,
        accessTierId: item.accessTierId,
        grantedById: ownerId,
        status: AccessGrantStatus.ACTIVE,
      });

      // Link grant to item
      item.accessGrantId = grant.id;
      await this.accessRequestItemRepository.save(item);

      // Log to audit
      await this.auditLogService.log({
        action: AuditAction.ITEM_PROVISIONED,
        actorId: ownerId,
        targetUserId: item.accessRequest.targetUserId,
        resourceType: 'access_request_item',
        resourceId: itemId,
        details: {
          grantId: grant.id,
          systemName: item.systemInstance?.system?.name,
          instanceName: item.systemInstance?.name,
          tierName: item.accessTier?.name,
        },
      });

      // Send notifications (non-blocking)
      try {
        const fullRequest = await this.accessRequestRepository.findOne({
          where: { id: item.accessRequestId },
          relations: ['requester', 'targetUser', 'items', 'items.systemInstance', 'items.systemInstance.system', 'items.accessTier'],
        });
        if (fullRequest) {
          this.logger.log(`[AccessRequestService] ✓✓✓ SENDING PROVISION NOTIFICATION to requester: ${fullRequest.requester?.email}`);
          await this.notificationService.notifyRequester({
            request: fullRequest,
            action: 'activate',
            link: this.deepLinkHelper.requestDetailsLink(fullRequest.id),
          });
          this.logger.log(`[AccessRequestService] ✓✓✓ PROVISION NOTIFICATION SENT SUCCESSFULLY`);
        }
      } catch (error) {
        // Don't fail the provisioning if notification fails
        this.logger.error(`[AccessRequestService] ❌ Failed to send provision notification: ${error instanceof Error ? error.message : String(error)}`);
      }

      return grant;
    } catch (err) {
      if (err instanceof ConflictException) {
        // Grant already exists - find it and link to item
        const existingGrant = await this.accessGrantRepository.findOne({
          where: {
            userId: item.accessRequest.targetUserId,
            systemInstanceId: item.systemInstanceId,
            accessTierId: item.accessTierId,
            status: AccessGrantStatus.ACTIVE,
          },
        });
        if (existingGrant) {
          item.accessGrantId = existingGrant.id;
          await this.accessRequestItemRepository.save(item);
          return existingGrant;
        }
        throw new ConflictException(
          `Active grant already exists for this user, instance, and tier. The item may have already been provisioned.`,
        );
      }
      throw err;
    }
  }

  /**
   * Bulk provision multiple approved request items
   * (PHASE2-004: System Owner Provisioning)
   */
  async bulkProvision(itemIds: string[], ownerId: string): Promise<{
    successful: AccessGrant[];
    failed: Array<{ id: string; reason: string }>;
  }> {
    const results = {
      successful: [] as AccessGrant[],
      failed: [] as Array<{ id: string; reason: string }>,
    };

    for (const itemId of itemIds) {
      try {
        const grant = await this.provisionItem(itemId, ownerId);
        results.successful.push(grant);
      } catch (error: any) {
        results.failed.push({
          id: itemId,
          reason: error.message || 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * PHASE2-007: Copy grants from one user to another
   * Creates access requests for all active grants of source user
   */
  async copyGrantsFromUser(
    dto: CopyGrantsDto,
    requesterId: string,
  ): Promise<CopyGrantsResult> {
    // 1. Validate users exist
    const sourceUser = await this.userRepository.findOne({
      where: { id: dto.sourceUserId },
    });
    if (!sourceUser) {
      throw new NotFoundException(`Source user with ID ${dto.sourceUserId} not found`);
    }

    const targetUser = await this.userRepository.findOne({
      where: { id: dto.targetUserId },
      relations: ['manager'],
    });
    if (!targetUser) {
      throw new NotFoundException(`Target user with ID ${dto.targetUserId} not found`);
    }

    // 2. Check authorization: requester must be manager of target user OR admin
    // Note: We'll check admin role via userInfo in controller, but here we check manager relationship
    const isManager = targetUser.managerId === requesterId;
    if (!isManager) {
      // Authorization check for admin will be done in controller
      // For now, we allow if requester is manager
    }

    // 3. Get source user's active grants
    let query = this.accessGrantRepository
      .createQueryBuilder('grant')
      .innerJoinAndSelect('grant.systemInstance', 'instance')
      .innerJoinAndSelect('instance.system', 'system')
      .innerJoinAndSelect('grant.accessTier', 'tier')
      .where('grant.userId = :sourceUserId', { sourceUserId: dto.sourceUserId })
      .andWhere('grant.status = :status', { status: AccessGrantStatus.ACTIVE });

    // Apply filters
    if (dto.systemIds && dto.systemIds.length > 0) {
      query = query.andWhere('system.id IN (:...systemIds)', {
        systemIds: dto.systemIds,
      });
    }
    if (dto.excludeSystemIds && dto.excludeSystemIds.length > 0) {
      query = query.andWhere('system.id NOT IN (:...excludeIds)', {
        excludeIds: dto.excludeSystemIds,
      });
    }

    const sourceGrants = await query.getMany();

    if (sourceGrants.length === 0) {
      return {
        created: [],
        skipped: [],
        summary: {
          total: 0,
          created: 0,
          skipped: 0,
          autoApproved: 0,
        },
      };
    }

    // 4. Get target user's existing grants and requests (to avoid duplicates)
    const existingGrants = await this.accessGrantRepository.find({
      where: {
        userId: dto.targetUserId,
        status: In([
          AccessGrantStatus.ACTIVE,
          AccessGrantStatus.TO_REMOVE,
        ]),
      },
    });

    // Get existing pending/approved requests for target user
    const existingRequests = await this.accessRequestRepository.find({
      where: {
        targetUserId: dto.targetUserId,
        status: In([
          AccessRequestStatus.REQUESTED,
          AccessRequestStatus.APPROVED,
        ]),
      },
      relations: ['items'],
    });

    // Create a set of existing access keys (systemInstanceId-accessTierId)
    const existingKeys = new Set<string>();
    existingGrants.forEach((g) => {
      existingKeys.add(`${g.systemInstanceId}-${g.accessTierId}`);
    });
    existingRequests.forEach((r) => {
      r.items?.forEach((item) => {
        if (item.status !== AccessRequestItemStatus.REJECTED) {
          existingKeys.add(`${item.systemInstanceId}-${item.accessTierId}`);
        }
      });
    });

    // 5. Create requests for each source grant
    const created: CopyGrantsResult['created'] = [];
    const skipped: CopyGrantsResult['skipped'] = [];

    for (const sourceGrant of sourceGrants) {
      const key = `${sourceGrant.systemInstanceId}-${sourceGrant.accessTierId}`;

      if (existingKeys.has(key)) {
        skipped.push({
          systemInstanceId: sourceGrant.systemInstanceId,
          accessTierId: sourceGrant.accessTierId,
          reason: 'Target user already has this access (active grant or pending request)',
        });
        continue;
      }

      // Create access request for this grant
      const requestDto: CreateAccessRequestDto = {
        targetUserId: dto.targetUserId,
        items: [
          {
            systemInstanceId: sourceGrant.systemInstanceId,
            accessTierId: sourceGrant.accessTierId,
          },
        ],
        note: `Copied from ${sourceUser.name}`,
      };

      const newRequest = await this.create(requestDto, requesterId);
      created.push({
        id: newRequest.id,
        status: newRequest.status,
        targetUserId: newRequest.targetUserId,
        items: newRequest.items.map((item) => ({
          id: item.id,
          systemInstanceId: item.systemInstanceId,
          accessTierId: item.accessTierId,
          status: item.status,
        })),
      });
    }

    // Calculate auto-approved count
    const autoApproved = created.filter((r) => r.status === AccessRequestStatus.APPROVED).length;

    return {
      created,
      skipped,
      summary: {
        total: sourceGrants.length,
        created: created.length,
        skipped: skipped.length,
        autoApproved,
      },
    };
  }
}

