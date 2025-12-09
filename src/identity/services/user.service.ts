import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { PaginationDto } from '../dto/pagination.dto';
import { UserNotFoundException } from '../../common/exceptions/user-not-found.exception';
import { DuplicateEmailException } from '../../common/exceptions/duplicate-email.exception';
import { InvalidManagerException } from '../../common/exceptions/invalid-manager.exception';
import { AccessGrant } from '../../access-control/entities/access-grant.entity';
import { AccessGrantStatus } from '../../access-control/entities/access-grant.entity';
import { AccessRequest } from '../../access-control/entities/access-request.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AccessGrant)
    private readonly accessGrantRepository: Repository<AccessGrant>,
    @InjectRepository(AccessRequest)
    private readonly accessRequestRepository: Repository<AccessRequest>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check if email already exists
    const existing = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existing) {
      throw new DuplicateEmailException(createUserDto.email);
    }

    const user = this.userRepository.create(createUserDto);
    return await this.userRepository.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { id },
      relations: ['manager'],
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { email },
      relations: ['manager'],
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new UserNotFoundException(id);
    }

    // If email is being updated, check for duplicates
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existing = await this.findByEmail(updateUserDto.email);
      if (existing) {
        throw new DuplicateEmailException(updateUserDto.email);
      }
    }

    Object.assign(user, updateUserDto);
    return await this.userRepository.save(user);
  }

  async findAll(pagination: PaginationDto) {
    const { page = 1, limit = 50 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await this.userRepository.findAndCount({
      relations: ['manager'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
      withDeleted: false, // Exclude soft-deleted users
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new UserNotFoundException(id);
    }
    
    // Remove all active access grants for this user
    const activeGrants = await this.accessGrantRepository.find({
      where: { userId: id, status: AccessGrantStatus.ACTIVE },
    });
    
    for (const grant of activeGrants) {
      grant.status = AccessGrantStatus.REMOVED;
      grant.removedAt = new Date();
      await this.accessGrantRepository.save(grant);
    }
    
    // Soft delete the user
    await this.userRepository.softRemove(user);
  }

  async assignManager(userId: string, managerId: string): Promise<User> {
    // Check if user exists
    const user = await this.findById(userId);
    if (!user) {
      throw new UserNotFoundException(userId);
    }

    // Check if manager exists
    const manager = await this.findById(managerId);
    if (!manager) {
      throw new UserNotFoundException(managerId);
    }

    // Prevent self-assignment
    if (userId === managerId) {
      throw new InvalidManagerException('User cannot be their own manager');
    }

    // Prevent circular references
    // Check if the proposed manager is in the user's management chain
    const isCircular = await this.checkCircularReference(userId, managerId);
    if (isCircular) {
      throw new InvalidManagerException(
        'Circular reference detected: user cannot be manager of their manager',
      );
    }

    user.managerId = managerId;
    await this.userRepository.save(user);

    // Reload with relations
    const updated = await this.findById(userId);
    if (!updated) {
      throw new UserNotFoundException(userId);
    }
    return updated;
  }

  private async checkCircularReference(
    userId: string,
    proposedManagerId: string,
  ): Promise<boolean> {
    // Traverse up the management chain from the proposed manager
    let currentManagerId = proposedManagerId;
    const visited = new Set<string>();

    while (currentManagerId) {
      // If we encounter the user in the chain, it's circular
      if (currentManagerId === userId) {
        return true;
      }

      // Prevent infinite loops
      if (visited.has(currentManagerId)) {
        break;
      }
      visited.add(currentManagerId);

      // Get the current manager's manager
      const currentManager = await this.userRepository.findOne({
        where: { id: currentManagerId },
        select: ['id', 'managerId'],
      });

      if (!currentManager || !currentManager.managerId) {
        break;
      }

      currentManagerId = currentManager.managerId;
    }

    return false;
  }

  async getMyGrants(userId: string) {
    const grants = await this.accessGrantRepository.find({
      where: { userId },
      relations: [
        'user',
        'systemInstance',
        'systemInstance.system',
        'accessTier',
        'grantedBy',
      ],
      order: { grantedAt: 'DESC' },
    });

    return {
      data: grants,
    };
  }

  async getMyRequests(userId: string) {
    // Get requests where user is either the requester or the target
    const requests = await this.accessRequestRepository.find({
      where: [
        { requesterId: userId },
        { targetUserId: userId },
      ],
      relations: [
        'requester',
        'targetUser',
        'items',
        'items.systemInstance',
        'items.systemInstance.system',
        'items.accessTier',
      ],
      order: { createdAt: 'DESC' },
    });

    return {
      data: requests,
    };
  }
}
