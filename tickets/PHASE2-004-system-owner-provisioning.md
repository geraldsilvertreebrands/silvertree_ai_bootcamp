# PHASE2-004: System Owner Provisioning

## Context

After a manager approves an access request (`approved` status), the system owner needs to provision the actual access in the external system and then mark the grant as `active`. This ticket implements that workflow.

## Acceptance Criteria

- [ ] **Mark Active Endpoint:**
  - [ ] `PATCH /api/v1/access-grants/:id/activate` - Mark grant as active
  - [ ] Only system owners of the grant's system can activate
  - [ ] Transitions status: `approved` → `active`
  - [ ] Uses existing `grantedById` and `grantedAt` fields (or sets if null)
  - [ ] Returns 403 if user is not system owner
  - [ ] Returns 400 if grant is not in `approved` status

- [ ] **Pending Provisioning Endpoint:**
  - [ ] `GET /api/v1/access-grants/pending-provisioning` - Get grants pending provisioning
  - [ ] Returns all `approved` grants for systems the current user owns
  - [ ] Include full relations
  - [ ] Support pagination and filtering by system

- [ ] **Bulk Activate:**
  - [ ] `POST /api/v1/access-grants/bulk-activate` - Activate multiple grants
  - [ ] Request body: array of grant IDs
  - [ ] Validates user is system owner for each grant's system
  - [ ] Returns results with success/failure per grant

- [ ] **Reuse Existing Guard:**
  - [ ] Use existing `@SystemOwner()` decorator for authorization
  - [ ] Ensure guard works for these new endpoints

## Technical Approach

### 1. Service Methods
```typescript
// src/access-control/services/access-grant.service.ts
async activateGrant(grantId: string, ownerId: string): Promise<AccessGrant> {
  const grant = await this.findOneOrFail(grantId);

  if (grant.status !== AccessGrantStatus.APPROVED) {
    throw new InvalidStatusTransitionException(
      grant.status,
      AccessGrantStatus.ACTIVE,
    );
  }

  grant.status = AccessGrantStatus.ACTIVE;
  // Set granted fields if not already set (from auto-approval)
  if (!grant.grantedById) {
    grant.grantedById = ownerId;
  }
  if (!grant.grantedAt) {
    grant.grantedAt = new Date();
  }

  return this.repository.save(grant);
}

async findPendingProvisioning(ownerId: string): Promise<AccessGrant[]> {
  // Get systems owned by this user
  const ownedSystems = await this.systemOwnerRepository.find({
    where: { userId: ownerId },
    select: ['systemId'],
  });
  const systemIds = ownedSystems.map(o => o.systemId);

  if (systemIds.length === 0) return [];

  return this.repository
    .createQueryBuilder('grant')
    .innerJoinAndSelect('grant.user', 'user')
    .innerJoinAndSelect('grant.systemInstance', 'instance')
    .innerJoinAndSelect('instance.system', 'system')
    .innerJoinAndSelect('grant.accessTier', 'tier')
    .leftJoinAndSelect('grant.requestedBy', 'requestedBy')
    .leftJoinAndSelect('grant.approvedBy', 'approvedBy')
    .where('grant.status = :status', { status: AccessGrantStatus.APPROVED })
    .andWhere('system.id IN (:...systemIds)', { systemIds })
    .orderBy('grant.approvedAt', 'ASC')
    .getMany();
}

async bulkActivate(
  grantIds: string[],
  ownerId: string,
): Promise<BulkOperationResult> {
  const results = {
    successful: [],
    failed: [],
  };

  for (const grantId of grantIds) {
    try {
      // Verify ownership
      const grant = await this.findOneOrFail(grantId);
      const isOwner = await this.systemOwnerService.isOwner(
        ownerId,
        grant.systemInstance.systemId,
      );

      if (!isOwner) {
        results.failed.push({
          id: grantId,
          reason: 'Not system owner',
        });
        continue;
      }

      const activated = await this.activateGrant(grantId, ownerId);
      results.successful.push(activated);
    } catch (error) {
      results.failed.push({
        id: grantId,
        reason: error.message,
      });
    }
  }

  return results;
}
```

### 2. Controller Endpoints
```typescript
// src/access-control/controllers/access-grants.controller.ts
@Patch(':id/activate')
@SystemOwner()
async activate(
  @Param('id', ParseUUIDPipe) id: string,
  @CurrentUser() user: User,
): Promise<AccessGrant> {
  return this.accessGrantService.activateGrant(id, user.id);
}

@Get('pending-provisioning')
async getPendingProvisioning(
  @CurrentUser() user: User,
  @Query() query: PaginationDto,
): Promise<AccessGrant[]> {
  return this.accessGrantService.findPendingProvisioning(user.id);
}

@Post('bulk-activate')
async bulkActivate(
  @Body() dto: BulkActivateDto,
  @CurrentUser() user: User,
): Promise<BulkOperationResult> {
  return this.accessGrantService.bulkActivate(dto.grantIds, user.id);
}
```

### 3. DTOs
```typescript
// src/access-control/dto/bulk-activate.dto.ts
export class BulkActivateDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  grantIds: string[];
}
```

## Agents to Use

| Step | Agent | Purpose |
|------|-------|---------|
| 1 | `/research` | Understand SystemOwner guard and service |
| 2 | `/workflow` | Verify status transition rules |
| 3 | `/testing` | Write tests for activation flow |
| 4 | `/backend` | Create service methods |
| 5 | `/backend` | Create controller endpoints |
| 6 | `/testing` | Verify all tests pass |

## Tests

- **Integration:**
  - [ ] System owner can activate `approved` grant
  - [ ] Activated grant has status `active`
  - [ ] grantedById set if not already set
  - [ ] grantedAt set if not already set
  - [ ] Non-owner gets 403 when trying to activate
  - [ ] Returns 400 when activating non-`approved` grant
  - [ ] GET /pending-provisioning returns only owned systems
  - [ ] GET /pending-provisioning excludes non-`approved` grants
  - [ ] Bulk activate processes multiple grants
  - [ ] Bulk activate returns per-grant results
  - [ ] Bulk activate skips grants user doesn't own

## Dependencies

- PHASE2-001 (Status enum must exist)
- PHASE2-003 (Approval flow must work)

## Progress

- YYYY-MM-DD: Ticket created

## Notes

- In Phase 3, this will trigger automatic API provisioning
- For now, system owner manually provisions and then marks active
- Consider notification to requester when activated (PHASE2-006)
