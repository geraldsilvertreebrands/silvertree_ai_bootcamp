import { Controller, Get, Query } from '@nestjs/common';
import { AuditLogService } from '../services/audit-log.service';
import { AuditAction } from '../entities/audit-log.entity';

@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async findAll(
    @Query('action') action?: AuditAction,
    @Query('actorId') actorId?: string,
    @Query('targetUserId') targetUserId?: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.auditLogService.findAll({
      action,
      actorId,
      targetUserId,
      resourceType,
      resourceId,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    return {
      data: result.data.map(log => ({
        id: log.id,
        action: log.action,
        actor: log.actor ? { id: log.actor.id, name: log.actor.name, email: log.actor.email } : null,
        targetUser: log.targetUser ? { id: log.targetUser.id, name: log.targetUser.name, email: log.targetUser.email } : null,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        details: log.details ? JSON.parse(log.details) : null,
        reason: log.reason,
        createdAt: log.createdAt,
      })),
      total: result.total,
    };
  }
}
