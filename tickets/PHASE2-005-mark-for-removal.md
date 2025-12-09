# PHASE2-005: Mark for Removal Flow

## Context

System owners need to be able to mark active grants for removal (`to_remove`) and then mark them as fully removed (`removed`). This completes the lifecycle management of access grants.

## Acceptance Criteria

- [ ] **Mark for Removal Endpoint:**
  - [ ] `PATCH /api/v1/access-grants/:id/to-remove` - Mark grant for removal
  - [ ] Only system owners can mark for removal
  - [ ] Transitions status: `active` → `to_remove`
  - [ ] Returns 403 if user is not system owner
  - [ ] Returns 400 if grant is not in `active` status

- [ ] **Mark Removed Endpoint:**
  - [ ] `PATCH /api/v1/access-grants/:id/remove` - Mark grant as removed
  - [ ] Only system owners can mark as removed
  - [ ] Transitions status: `to_remove` → `removed`
  - [ ] Sets `removedAt` to current timestamp
  - [ ] Returns 403 if user is not system owner
  - [ ] Returns 400 if grant is not in `to_remove` status

- [ ] **Cancel Removal Endpoint:**
  - [ ] `PATCH /api/v1/access-grants/:id/cancel-removal` - Cancel pending removal
  - [ ] Only system owners can cancel removal
  - [ ] Transitions status: `to_remove` → `active`
  - [ ] Returns 403 if user is not system owner
  - [ ] Returns 400 if grant is not in `to_remove` status

- [ ] **Pending Removal Endpoint:**
  - [ ] `GET /api/v1/access-grants/pending-removal` - Get grants pending removal
  - [ ] Returns all `to_remove` grants for systems the current user owns
  - [ ] Include full relations
  - [ ] Support pagination

- [ ] **Bulk Operations:**
  - [ ] `POST /api/v1/access-grants/bulk-to-remove` - Mark multiple for removal
  - [ ] `POST /api/v1/access-grants/bulk-remove` - Mark multiple as removed

## Technical Approach

### 1. Service Methods
```typescript
// src/access-control/services/access-grant.service.ts
async markToRemove(grantId: string, ownerId: string): Promise<AccessGrant> {
  const grant = await this.findOneOrFail(grantId);

  if (grant.status !== AccessGrantStatus.ACTIVE) {
    throw new InvalidStatusTransitionException(
      grant.status,
      AccessGrantStatus.TO_REMOVE,
    );
  }

  grant.status = AccessGrantStatus.TO_REMOVE;
  return this.repository.save(grant);
}

async markRemoved(grantId: string, ownerId: string): Promise<AccessGrant> {
  const grant = await this.findOneOrFail(grantId);

  if (grant.status !== AccessGrantStatus.TO_REMOVE) {
    throw new InvalidStatusTransitionException(
      grant.status,
      AccessGrantStatus.REMOVED,
    );
  }

  grant.status = AccessGrantStatus.REMOVED;
  grant.removedAt = new Date();
  return this.repository.save(grant);
}

async cancelRemoval(grantId: string, ownerId: string): Promise<AccessGrant> {
  const grant = await this.findOneOrFail(grantId);

  if (grant.status !== AccessGrantStatus.TO_REMOVE) {
    throw new InvalidStatusTransitionException(
      grant.status,
      AccessGrantStatus.ACTIVE,
    );
  }

  grant.status = AccessGrantStatus.ACTIVE;
  return this.repository.save(grant);
}

async findPendingRemoval(ownerId: string): Promise<AccessGrant[]> {
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
    .where('grant.status = :status', { status: AccessGrantStatus.TO_REMOVE })
    .andWhere('system.id IN (:...systemIds)', { systemIds })
    .orderBy('grant.updatedAt', 'ASC')
    .getMany();
}
```

### 2. Controller Endpoints
```typescript
// src/access-control/controllers/access-grants.controller.ts
@Patch(':id/to-remove')
@SystemOwner()
async markToRemove(
  @Param('id', ParseUUIDPipe) id: string,
  @CurrentUser() user: User,
): Promise<AccessGrant> {
  return this.accessGrantService.markToRemove(id, user.id);
}

@Patch(':id/remove')
@SystemOwner()
async markRemoved(
  @Param('id', ParseUUIDPipe) id: string,
  @CurrentUser() user: User,
): Promise<AccessGrant> {
  return this.accessGrantService.markRemoved(id, user.id);
}

@Patch(':id/cancel-removal')
@SystemOwner()
async cancelRemoval(
  @Param('id', ParseUUIDPipe) id: string,
  @CurrentUser() user: User,
): Promise<AccessGrant> {
  return this.accessGrantService.cancelRemoval(id, user.id);
}

@Get('pending-removal')
async getPendingRemoval(
  @CurrentUser() user: User,
): Promise<AccessGrant[]> {
  return this.accessGrantService.findPendingRemoval(user.id);
}
```

## Agents to Use

| Step | Agent | Purpose |
|------|-------|---------|
| 1 | `/workflow` | Verify removal status transitions |
| 2 | `/testing` | Write tests for removal flow |
| 3 | `/backend` | Create service methods |
| 4 | `/backend` | Create controller endpoints |
| 5 | `/testing` | Verify all tests pass |

## Tests

- **Integration:**
  - [ ] System owner can mark `active` grant as `to_remove`
  - [ ] System owner can mark `to_remove` grant as `removed`
  - [ ] System owner can cancel removal (`to_remove` → `active`)
  - [ ] removedAt is set when marking as removed
  - [ ] Non-owner gets 403 for all removal operations
  - [ ] Returns 400 for invalid status transitions
  - [ ] GET /pending-removal returns only owned systems
  - [ ] Bulk to-remove processes multiple grants
  - [ ] Bulk remove processes multiple grants

## Dependencies

- PHASE2-001 (Status enum must exist)
- PHASE2-004 (Grants must be activatable first)

## Progress

- YYYY-MM-DD: Ticket created

## Notes

- `to_remove` is a two-step process: mark for removal, then confirm removal
- This allows for review before final removal
- In Phase 3, marking `to_remove` will trigger automatic de-provisioning
- Consider notification when marked for removal (PHASE2-006)
