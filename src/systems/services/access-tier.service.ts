import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessTier } from '../entities/access-tier.entity';
import { CreateAccessTierDto } from '../dto/create-access-tier.dto';
import { UpdateAccessTierDto } from '../dto/update-access-tier.dto';
import { SystemNotFoundException } from '../../common/exceptions/system-not-found.exception';
import { DuplicateTierNameException } from '../../common/exceptions/duplicate-tier-name.exception';
import { AccessTierNotFoundException } from '../../common/exceptions/access-tier-not-found.exception';
import { SystemService } from './system.service';

@Injectable()
export class AccessTierService {
  constructor(
    @InjectRepository(AccessTier)
    private readonly accessTierRepository: Repository<AccessTier>,
    private readonly systemService: SystemService,
  ) {}

  async create(createTierDto: CreateAccessTierDto): Promise<AccessTier> {
    // Verify system exists
    const system = await this.systemService.findById(createTierDto.systemId);
    if (!system) {
      throw new SystemNotFoundException(createTierDto.systemId);
    }

    // Check if tier name already exists for this system
    const existing = await this.accessTierRepository.findOne({
      where: {
        systemId: createTierDto.systemId,
        name: createTierDto.name,
      },
    });

    if (existing) {
      throw new DuplicateTierNameException(createTierDto.name, createTierDto.systemId);
    }

    const tier = this.accessTierRepository.create(createTierDto);
    return await this.accessTierRepository.save(tier);
  }

  async findById(id: string): Promise<AccessTier | null> {
    return await this.accessTierRepository.findOne({
      where: { id },
      relations: ['system'],
    });
  }

  async findBySystemId(systemId: string): Promise<AccessTier[]> {
    return await this.accessTierRepository.find({
      where: { systemId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, updateTierDto: UpdateAccessTierDto): Promise<AccessTier> {
    const tier = await this.findById(id);
    if (!tier) {
      throw new AccessTierNotFoundException(id);
    }

    // If name is being updated, check for duplicates within the same system
    if (updateTierDto.name && updateTierDto.name !== tier.name) {
      const existing = await this.accessTierRepository.findOne({
        where: {
          systemId: tier.systemId,
          name: updateTierDto.name,
        },
      });
      if (existing) {
        throw new DuplicateTierNameException(updateTierDto.name, tier.systemId);
      }
    }

    Object.assign(tier, updateTierDto);
    return await this.accessTierRepository.save(tier);
  }
}
