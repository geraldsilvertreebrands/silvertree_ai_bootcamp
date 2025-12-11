import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';

export interface AuditLogEntry {
  action: AuditAction;
  actorId: string;
  targetUserId?: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, any>;
  reason?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(entry: AuditLogEntry): Promise<AuditLog | null> {
    try {
      const auditLog = this.auditLogRepository.create({
        action: entry.action,
        actorId: entry.actorId,
        targetUserId: entry.targetUserId,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        details: entry.details ? JSON.stringify(entry.details) : undefined,
        reason: entry.reason,
      });

      const saved = await this.auditLogRepository.save(auditLog);
      this.logger.log(`[AuditLog] ${entry.action} by ${entry.actorId} on ${entry.resourceType}:${entry.resourceId}`);
      return saved;
    } catch (error) {
      this.logger.error(`[AuditLog] Failed to create audit log: ${error instanceof Error ? error.message : String(error)}`);
      // Don't throw - audit logging should not break the main flow
      return null;
    }
  }

  async findAll(options?: {
    action?: AuditAction;
    actorId?: string;
    targetUserId?: string;
    resourceType?: string;
    resourceId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AuditLog[]; total: number }> {
    const query = this.auditLogRepository.createQueryBuilder('audit')
      .leftJoinAndSelect('audit.actor', 'actor')
      .leftJoinAndSelect('audit.targetUser', 'targetUser')
      .orderBy('audit.createdAt', 'DESC');

    if (options?.action) {
      query.andWhere('audit.action = :action', { action: options.action });
    }
    if (options?.actorId) {
      query.andWhere('audit.actorId = :actorId', { actorId: options.actorId });
    }
    if (options?.targetUserId) {
      query.andWhere('audit.targetUserId = :targetUserId', { targetUserId: options.targetUserId });
    }
    if (options?.resourceType) {
      query.andWhere('audit.resourceType = :resourceType', { resourceType: options.resourceType });
    }
    if (options?.resourceId) {
      query.andWhere('audit.resourceId = :resourceId', { resourceId: options.resourceId });
    }

    const total = await query.getCount();

    if (options?.limit) {
      query.take(options.limit);
    }
    if (options?.offset) {
      query.skip(options.offset);
    }

    const data = await query.getMany();
    return { data, total };
  }

  async findByResource(resourceType: string, resourceId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { resourceType, resourceId },
      relations: ['actor', 'targetUser'],
      order: { createdAt: 'DESC' },
    });
  }
}
