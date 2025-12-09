import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemOwner } from '../entities/system-owner.entity';
import { User } from '../../identity/entities/user.entity';
import { System } from '../../systems/entities/system.entity';
import { AssignSystemOwnerDto } from '../dto/assign-system-owner.dto';

@Injectable()
export class SystemOwnerService {
  constructor(
    @InjectRepository(SystemOwner)
    private systemOwnerRepository: Repository<SystemOwner>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(System)
    private systemRepository: Repository<System>,
  ) {}

  async assign(systemId: string, assignDto: AssignSystemOwnerDto): Promise<SystemOwner> {
    const { userId } = assignDto;

    // Validate system exists
    const system = await this.systemRepository.findOne({ where: { id: systemId } });
    if (!system) {
      throw new NotFoundException(`System with ID ${systemId} not found`);
    }

    // Validate user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check for duplicate ownership
    const existing = await this.systemOwnerRepository.findOne({
      where: { userId, systemId },
    });

    if (existing) {
      throw new ConflictException(
        `User '${user.name}' is already an owner of system '${system.name}'`,
      );
    }

    // Create ownership
    const owner = this.systemOwnerRepository.create({
      userId,
      systemId,
    });

    const savedOwner = await this.systemOwnerRepository.save(owner);

    // Load relations
    const fullOwner = await this.systemOwnerRepository.findOne({
      where: { id: savedOwner.id },
      relations: ['user', 'system'],
    });

    if (!fullOwner) {
      throw new NotFoundException(`SystemOwner with ID ${savedOwner.id} not found after save`);
    }

    return fullOwner;
  }

  async findBySystem(systemId: string): Promise<SystemOwner[]> {
    // Validate system exists
    const system = await this.systemRepository.findOne({ where: { id: systemId } });
    if (!system) {
      throw new NotFoundException(`System with ID ${systemId} not found`);
    }

    return this.systemOwnerRepository.find({
      where: { systemId },
      relations: ['user'],
    });
  }

  async findByUser(userId: string): Promise<SystemOwner[]> {
    // Validate user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.systemOwnerRepository.find({
      where: { userId },
      relations: ['system'],
    });
  }

  async remove(systemId: string, userId: string): Promise<void> {
    // Validate system exists
    const system = await this.systemRepository.findOne({ where: { id: systemId } });
    if (!system) {
      throw new NotFoundException(`System with ID ${systemId} not found`);
    }

    // Validate user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Find ownership
    const owner = await this.systemOwnerRepository.findOne({
      where: { userId, systemId },
    });

    if (!owner) {
      throw new NotFoundException(
        `User '${user.name}' is not an owner of system '${system.name}'`,
      );
    }

    // Remove ownership
    await this.systemOwnerRepository.remove(owner);
  }

  async isSystemOwner(userId: string, systemId: string): Promise<boolean> {
    const owner = await this.systemOwnerRepository.findOne({
      where: { userId, systemId },
    });
    return !!owner;
  }
}




