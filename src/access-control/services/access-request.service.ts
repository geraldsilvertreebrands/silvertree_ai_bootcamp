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
    
    // Send notifications (non-blocking)
    try {
      this.logger.log(`[AccessRequestService] ========== NOTIFICATION DEBUG START ==========`);
      this.logger.log(`[AccessRequestService] Request created: ${fullRequest.id}, status: ${fullRequest.status}`);
      this.logger.log(`[AccessRequestService] Target user: ${fullRequest.targetUser?.email}, Manager ID: ${fullRequest.targetUser?.managerId}, Manager loaded: ${!!fullRequest.targetUser?.manager}, Manager email: ${fullRequest.targetUser?.manager?.email || 'NOT LOADED'}`);
      this.logger.log(`[AccessRequestService] Notification service type: ${this.notificationService?.constructor?.name || 'UNKNOWN'}`);
      this.logger.log(`[AccessRequestService] Notification service exists: ${!!this.notificationService}`);
      
      // CRITICAL: Always notify manager when request is created (REQUESTED status)
      // Use the SAME logic as approveRequest - ensure manager relation is loaded
      if (fullRequest.status === AccessRequestStatus.REQUESTED) {
        this.logger.log(`[AccessRequestService] Status is REQUESTED - proceeding with manager notification`);
        const managerEmail = fullRequest.targetUser?.manager?.email;
        if (managerEmail) {
          this.logger.log(`[AccessRequestService] ✓✓✓ SENDING MANAGER NOTIFICATION for request ${fullRequest.id} to: ${managerEmail}`);
          this.logger.log(`[AccessRequestService] Manager relation loaded: ${!!fullRequest.targetUser?.manager}, Manager ID: ${fullRequest.targetUser?.managerId}`);
          try {
            this.logger.log(`[AccessRequestService] Calling notificationService.notifyManager...`);
            await this.notificationService.notifyManager({
              request: fullRequest,
              action: 'request',
              link: this.deepLinkHelper.approvalLink(fullRequest.id),
            });
            this.logger.log(`[AccessRequestService] ✓✓✓ MANAGER NOTIFICATION SENT SUCCESSFULLY to ${managerEmail}`);
          } catch (notifError) {
            this.logger.error(`[AccessRequestService] ❌ FAILED to send manager notification: ${notifError instanceof Error ? notifError.message : String(notifError)}`);
            this.logger.error(`[AccessRequestService] Error stack: ${notifError instanceof Error ? notifError.stack : 'N/A'}`);
          }
        } else {
          this.logger.error(`[AccessRequestService] ❌ CANNOT send manager notification - no manager email!`);
          this.logger.error(`[AccessRequestService] Target user: ${fullRequest.targetUser?.email}, Manager ID: ${fullRequest.targetUser?.managerId}, Manager loaded: ${!!fullRequest.targetUser?.manager}`);
        }
      } else {
        this.logger.log(`[AccessRequestService] Status is ${fullRequest.status} - NOT REQUESTED, skipping manager notification`);
      }
      this.logger.log(`[AccessRequestService] ========== NOTIFICATION DEBUG END ==========`);
      
      // If auto-approved, also notify system owners
      if (fullRequest.status === AccessRequestStatus.APPROVED) {
        this.logger.log(`[AccessRequestService] Request ${fullRequest.id} was auto-approved, also notifying system owners`);
        await this.notificationService.notifySystemOwners({
          request: fullRequest,
          action: 'approve',
          link: this.deepLinkHelper.pendingProvisioningLink(),
        });
      }
    } catch (error) {
      // Don't fail the request creation if notification fails
      this.logger.error(`[AccessRequestService] Failed to send notification: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
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
    
    // Send notifications (non-blocking)
    try {
      if (updatedRequest.status === AccessRequestStatus.APPROVED) {
        this.logger.log(`[AccessRequestService] Request ${requestId} approved, sending notifications`);
        
        // CRITICAL: Only notify requester, NOT manager
        // Manager should ONLY receive request notifications, never approval notifications
        if (updatedRequest.requester?.email) {
          this.logger.log(`[AccessRequestService] ✓✓✓ SENDING REQUESTER APPROVAL NOTIFICATION to: ${updatedRequest.requester.email}`);
          this.logger.log(`[AccessRequestService] Requester relation loaded: ${!!updatedRequest.requester}, Requester ID: ${updatedRequest.requesterId}`);
          this.logger.log(`[AccessRequestService] Manager email: ${updatedRequest.targetUser?.manager?.email || 'N/A'} - should NOT receive this notification`);
          try {
            await this.notificationService.notifyRequester({
              request: updatedRequest,
              action: 'approve',
              link: this.deepLinkHelper.requestDetailsLink(updatedRequest.id),
            });
            this.logger.log(`[AccessRequestService] ✓✓✓ REQUESTER APPROVAL NOTIFICATION SENT SUCCESSFULLY to ${updatedRequest.requester.email}`);
          } catch (notifError) {
            this.logger.error(`[AccessRequestService] ❌ FAILED to send requester approval notification: ${notifError instanceof Error ? notifError.message : String(notifError)}`);
            this.logger.error(`[AccessRequestService] Error stack: ${notifError instanceof Error ? notifError.stack : 'N/A'}`);
          }
        } else {
          this.logger.error(`[AccessRequestService] ❌ CANNOT notify requester - requester not loaded!`);
          this.logger.error(`[AccessRequestService] Requester ID: ${updatedRequest.requesterId}, Requester loaded: ${!!updatedRequest.requester}`);
        }
        
        // Notify system owners for provisioning
        await this.notificationService.notifySystemOwners({
          request: updatedRequest,
          action: 'approve',
          link: this.deepLinkHelper.pendingProvisioningLink(),
        });
        this.logger.log(`[AccessRequestService] System owners notified`);
      }
    } catch (error) {
      // Don't fail the approval if notification fails
      this.logger.error(`[AccessRequestService] Failed to send notification: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
    }
    
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
    
    // Send notifications (non-blocking)
    try {
      this.logger.log(`[AccessRequestService] Request ${requestId} rejected, notifying requester`);
      this.logger.log(`[AccessRequestService] Requester: ${updatedRequest.requester?.email || 'NOT LOADED'}, Reason: ${reason || 'No reason provided'}`);
      
      if (updatedRequest.requester?.email) {
        await this.notificationService.notifyRequester({
          request: updatedRequest,
          action: 'reject',
          reason,
          link: this.deepLinkHelper.requestDetailsLink(updatedRequest.id),
        });
        this.logger.log(`[AccessRequestService] Requester rejection notification sent`);
      } else {
        this.logger.warn(`[AccessRequestService] Cannot notify requester - requester not loaded or no email`);
      }
    } catch (error) {
      // Don't fail the rejection if notification fails
      this.logger.error(`[AccessRequestService] Failed to send notification: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
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

    // Send notification to requester when system owner rejects an approved item
    if (updatedItem && updatedItem.status === AccessRequestItemStatus.REJECTED) {
      try {
        const fullRequest = await this.loadRequestWithItems(updatedItem.accessRequestId);
        this.logger.log(`[AccessRequestService] System owner rejected approved item ${itemId}, notifying requester`);
        if (fullRequest.requester?.email) {
          await this.notificationService.notifyRequester({
            request: fullRequest,
            action: 'reject',
            reason: note || 'Rejected by system owner',
            link: this.deepLinkHelper.requestDetailsLink(fullRequest.id),
          });
          this.logger.log(`[AccessRequestService] Requester notification sent for rejected item`);
        }
      } catch (error) {
        this.logger.error(`[AccessRequestService] Failed to send notification: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
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

    // Find approved items for owned systems that don't have grants yet
    return this.accessRequestItemRepository
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.accessRequest', 'request')
      .innerJoinAndSelect('request.targetUser', 'targetUser')
      .innerJoinAndSelect('request.requester', 'requester')
      .innerJoinAndSelect('item.systemInstance', 'systemInstance')
      .innerJoinAndSelect('systemInstance.system', 'system')
      .innerJoinAndSelect('item.accessTier', 'accessTier')
      .where('item.status = :status', { status: AccessRequestItemStatus.APPROVED })
      .andWhere('system.id IN (:...systemIds)', { systemIds })
      .andWhere('item.accessGrantId IS NULL') // Only items that haven't been provisioned yet
      .orderBy('item.createdAt', 'ASC')
      .getMany();
  }

  /**
   * Provision an approved request item by creating an active grant
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

    // Check item is approved
    if (item.status !== AccessRequestItemStatus.APPROVED) {
      throw new BadRequestException(
        `Cannot provision item in status '${item.status}'. Only 'approved' items can be provisioned.`,
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

    // Check authorization: user must be system owner
    const isOwner = await this.systemOwnerService.isSystemOwner(ownerId, item.systemInstance.systemId);
    if (!isOwner) {
      throw new ForbiddenException(
        `You are not authorized to provision items for system '${item.systemInstance.system.name}'. You must be a system owner.`,
      );
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

      // Send notifications (non-blocking)
      try {
        const fullRequest = await this.accessRequestRepository.findOne({
          where: { id: item.accessRequestId },
          relations: ['requester', 'targetUser', 'items', 'items.systemInstance', 'items.systemInstance.system', 'items.accessTier'],
        });
        if (fullRequest) {
          await this.notificationService.notifyRequester({
            request: fullRequest,
            action: 'activate',
            link: this.deepLinkHelper.requestDetailsLink(fullRequest.id),
          });
        }
      } catch (error) {
        // Don't fail the provisioning if notification fails
        console.error('Failed to send notification:', error);
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

