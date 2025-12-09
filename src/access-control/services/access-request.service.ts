import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
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
      relations: ['items'],
    });

    if (!fullRequest) {
      throw new NotFoundException(`AccessRequest ${savedRequest.id} not found after create`);
    }

    (fullRequest as any).items = savedItems;
    return fullRequest as AccessRequest & { items: AccessRequestItem[] };
  }
}

