import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemInstance } from '../entities/system-instance.entity';
import { CreateSystemInstanceDto } from '../dto/create-system-instance.dto';
import { UpdateSystemInstanceDto } from '../dto/update-system-instance.dto';
import { SystemNotFoundException } from '../../common/exceptions/system-not-found.exception';
import { DuplicateInstanceNameException } from '../../common/exceptions/duplicate-instance-name.exception';
import { SystemInstanceNotFoundException } from '../../common/exceptions/system-instance-not-found.exception';
import { SystemService } from './system.service';

@Injectable()
export class SystemInstanceService {
  constructor(
    @InjectRepository(SystemInstance)
    private readonly systemInstanceRepository: Repository<SystemInstance>,
    private readonly systemService: SystemService,
  ) {}

  async create(createInstanceDto: CreateSystemInstanceDto): Promise<SystemInstance> {
    // Verify system exists
    const system = await this.systemService.findById(createInstanceDto.systemId);
    if (!system) {
      throw new SystemNotFoundException(createInstanceDto.systemId);
    }

    // Check if instance name already exists for this system
    const existing = await this.systemInstanceRepository.findOne({
      where: {
        systemId: createInstanceDto.systemId,
        name: createInstanceDto.name,
      },
    });

    if (existing) {
      throw new DuplicateInstanceNameException(createInstanceDto.name, createInstanceDto.systemId);
    }

    const instance = this.systemInstanceRepository.create(createInstanceDto);
    return await this.systemInstanceRepository.save(instance);
  }

  async findById(id: string): Promise<SystemInstance | null> {
    return await this.systemInstanceRepository.findOne({
      where: { id },
      relations: ['system'],
    });
  }

  async findBySystemId(systemId: string): Promise<SystemInstance[]> {
    return await this.systemInstanceRepository.find({
      where: { systemId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, updateInstanceDto: UpdateSystemInstanceDto): Promise<SystemInstance> {
    const instance = await this.findById(id);
    if (!instance) {
      throw new SystemInstanceNotFoundException(id);
    }

    // If name is being updated, check for duplicates within the same system
    if (updateInstanceDto.name && updateInstanceDto.name !== instance.name) {
      const existing = await this.systemInstanceRepository.findOne({
        where: {
          systemId: instance.systemId,
          name: updateInstanceDto.name,
        },
      });
      if (existing) {
        throw new DuplicateInstanceNameException(updateInstanceDto.name, instance.systemId);
      }
    }

    Object.assign(instance, updateInstanceDto);
    return await this.systemInstanceRepository.save(instance);
  }
}
