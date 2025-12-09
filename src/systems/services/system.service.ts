import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { System } from '../entities/system.entity';
import { CreateSystemDto } from '../dto/create-system.dto';
import { UpdateSystemDto } from '../dto/update-system.dto';
import { SystemNotFoundException } from '../../common/exceptions/system-not-found.exception';
import { DuplicateSystemNameException } from '../../common/exceptions/duplicate-system-name.exception';

@Injectable()
export class SystemService {
  constructor(
    @InjectRepository(System)
    private readonly systemRepository: Repository<System>,
  ) {}

  async create(createSystemDto: CreateSystemDto): Promise<System> {
    // Check if system name already exists
    const existing = await this.systemRepository.findOne({
      where: { name: createSystemDto.name },
    });

    if (existing) {
      throw new DuplicateSystemNameException(createSystemDto.name);
    }

    const system = this.systemRepository.create(createSystemDto);
    return await this.systemRepository.save(system);
  }

  async findById(id: string): Promise<System | null> {
    return await this.systemRepository.findOne({ where: { id } });
  }

  async findAll(): Promise<System[]> {
    return await this.systemRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, updateSystemDto: UpdateSystemDto): Promise<System> {
    const system = await this.findById(id);
    if (!system) {
      throw new SystemNotFoundException(id);
    }

    // If name is being updated, check for duplicates
    if (updateSystemDto.name && updateSystemDto.name !== system.name) {
      const existing = await this.systemRepository.findOne({
        where: { name: updateSystemDto.name },
      });
      if (existing) {
        throw new DuplicateSystemNameException(updateSystemDto.name);
      }
    }

    Object.assign(system, updateSystemDto);
    return await this.systemRepository.save(system);
  }
}
