import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessGrant } from '../entities/access-grant.entity';
import { AccessOverviewQueryDto } from '../dto/access-overview-query.dto';

@Injectable()
export class AccessGrantQueryService {
  constructor(
    @InjectRepository(AccessGrant)
    private readonly accessGrantRepository: Repository<AccessGrant>,
  ) {}

  async findAll(query: AccessOverviewQueryDto) {
    const {
      userId,
      systemId,
      systemInstanceId,
      accessTierId,
      status,
      userSearch,
      page = 1,
      limit = 50,
      sortBy = 'grantedAt',
      sortOrder = 'DESC',
    } = query;

    const queryBuilder = this.accessGrantRepository
      .createQueryBuilder('grant')
      .leftJoinAndSelect('grant.user', 'user')
      .leftJoinAndSelect('grant.systemInstance', 'systemInstance')
      .leftJoinAndSelect('systemInstance.system', 'system')
      .leftJoinAndSelect('grant.accessTier', 'accessTier')
      .leftJoinAndSelect('grant.grantedBy', 'grantedBy');

    // Apply filters
    if (userId) {
      queryBuilder.andWhere('grant.userId = :userId', { userId });
    }

    if (systemId) {
      queryBuilder.andWhere('systemInstance.systemId = :systemId', {
        systemId,
      });
    }

    if (systemInstanceId) {
      queryBuilder.andWhere('grant.systemInstanceId = :systemInstanceId', {
        systemInstanceId,
      });
    }

    if (accessTierId) {
      queryBuilder.andWhere('grant.accessTierId = :accessTierId', {
        accessTierId,
      });
    }

    if (status) {
      queryBuilder.andWhere('grant.status = :status', { status });
    }

    if (userSearch) {
      queryBuilder.andWhere('(user.name ILIKE :userSearch OR user.email ILIKE :userSearch)', {
        userSearch: `%${userSearch}%`,
      });
    }

    // Apply sorting
    switch (sortBy) {
      case 'userName':
        queryBuilder.orderBy('user.name', sortOrder);
        break;
      case 'systemName':
        queryBuilder.orderBy('system.name', sortOrder);
        break;
      case 'grantedAt':
      default:
        queryBuilder.orderBy('grant.grantedAt', sortOrder);
        break;
    }

    // Add secondary sort by ID for consistent pagination
    queryBuilder.addOrderBy('grant.id', 'ASC');

    // Apply pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
