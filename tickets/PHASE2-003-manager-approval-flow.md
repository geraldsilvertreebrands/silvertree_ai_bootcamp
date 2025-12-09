# PHASE2-003: Manager Approval Flow

## Context

When an access request is created in `requested` status, the manager of the grantee needs to approve or reject it. This ticket implements the manager approval workflow.

## Acceptance Criteria

- [ ] **Approve Endpoint:**
  - [ ] `PATCH /api/v1/access-requests/:id/approve` - Approve a request
  - [ ] Only the manager of the grantee can approve
  - [ ] Transitions status: `requested` → `approved`
  - [ ] Sets `approvedById` from authenticated user
  - [ ] Sets `approvedAt` to current timestamp
  - [ ] Returns 403 if user is not the grantee's manager
  - [ ] Returns 400 if request is not in `requested` status

- [ ] **Reject Endpoint:**
  - [ ] `PATCH /api/v1/access-requests/:id/reject` - Reject a request
  - [ ] Request body: `reason` (required, string)
  - [ ] Only the manager of the grantee can reject
  - [ ] Transitions status: `requested` → `rejected`
  - [ ] Sets `rejectedById`, `rejectedAt`, `rejectionReason`
  - [ ] Returns 403 if user is not the grantee's manager
  - [ ] Returns 400 if request is not in `requested` status

- [ ] **My Pending Approvals Endpoint:**
  - [ ] `GET /api/v1/access-requests/pending` - Get requests pending my approval
  - [ ] Returns all `requested` grants where current user is the grantee's manager
  - [ ] Include full relations (user, system, instance, tier, requestedBy)
  - [ ] Support pagination

- [ ] **Status Transition Validation:**
  - [ ] Create status transition validator
  - [ ] Only allow valid transitions (see state machine)
  - [ ] Return 400 with clear message for invalid transitions

## Technical Approach

### 1. Status Transition Validator
```typescript
// src/access-control/services/status-transition.validator.ts
const VALID_TRANSITIONS: Record<AccessGrantStatus, AccessGrantStatus[]> = {
  [AccessGrantStatus.REQUESTED]: [
    AccessGrantStatus.APPROVED,
    AccessGrantStatus.REJECTED,
  ],
  [AccessGrantStatus.APPROVED]: [
    AccessGrantStatus.ACTIVE,
  ],
  [AccessGrantStatus.REJECTED]: [], // Terminal state
  [AccessGrantStatus.ACTIVE]: [
    AccessGrantStatus.TO_REMOVE,
  ],
  [AccessGrantStatus.TO_REMOVE]: [
    AccessGrantStatus.REMOVED,
    AccessGrantStatus.ACTIVE, // Can cancel removal
  ],
  [AccessGrantStatus.REMOVED]: [], // Terminal state
};

export function canTransition(
  from: AccessGrantStatus,
  to: AccessGrantStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

### 2. Manager Guard
```typescript
// src/common/guards/manager.guard.ts
@Injectable()
export class ManagerGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const currentUserId = request.user?.id;
    const grantId = request.params.id;

    const grant = await this.accessGrantRepository.findOne({
      where: { id: grantId },
      relations: ['user'],
    });

    if (!grant) throw new NotFoundException();

    // Check if current user is the manager of the grantee
    if (grant.user.managerId !== currentUserId) {
      throw new ForbiddenException(
        'Only the manager of the grantee can perform this action'
      );
    }

    return true;
  }
}
```

### 3. Service Methods
```typescript
// src/access-control/services/access-grant.service.ts
async approveRequest(grantId: string, approverId: string): Promise<AccessGrant> {
  const grant = await this.findOneOrFail(grantId);

  if (grant.status !== AccessGrantStatus.REQUESTED) {
    throw new InvalidStatusTransitionException(
      grant.status,
      AccessGrantStatus.APPROVED,
    );
  }

  grant.status = AccessGrantStatus.APPROVED;
  grant.approvedById = approverId;
  grant.approvedAt = new Date();

  return this.repository.save(grant);
}

async rejectRequest(
  grantId: string,
  rejecterId: string,
  reason: string,
): Promise<AccessGrant> {
  const grant = await this.findOneOrFail(grantId);

  if (grant.status !== AccessGrantStatus.REQUESTED) {
    throw new InvalidStatusTransitionException(
      grant.status,
      AccessGrantStatus.REJECTED,
    );
  }

  grant.status = AccessGrantStatus.REJECTED;
  grant.rejectedById = rejecterId;
  grant.rejectedAt = new Date();
  grant.rejectionReason = reason;

  return this.repository.save(grant);
}

async findPendingForManager(managerId: string): Promise<AccessGrant[]> {
  return this.repository
    .createQueryBuilder('grant')
    .innerJoinAndSelect('grant.user', 'user')
    .innerJoinAndSelect('grant.systemInstance', 'instance')
    .innerJoinAndSelect('instance.system', 'system')
    .innerJoinAndSelect('grant.accessTier', 'tier')
    .leftJoinAndSelect('grant.requestedBy', 'requestedBy')
    .where('grant.status = :status', { status: AccessGrantStatus.REQUESTED })
    .andWhere('user.managerId = :managerId', { managerId })
    .orderBy('grant.requestedAt', 'ASC')
    .getMany();
}
```

### 4. DTOs
```typescript
// src/access-control/dto/reject-request.dto.ts
export class RejectRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
```

## Agents to Use

| Step | Agent | Purpose |
|------|-------|---------|
| 1 | `/research` | Understand manager relationship in User entity |
| 2 | `/workflow` | Design status transition validation |
| 3 | `/testing` | Write tests for approve/reject flows |
| 4 | `/backend` | Create ManagerGuard |
| 5 | `/backend` | Create service methods and controller |
| 6 | `/testing` | Verify all tests pass |

## Tests

- **Integration:**
  - [ ] Manager can approve `requested` grant
  - [ ] Approved grant has status `approved`
  - [ ] Approved grant has approvedById and approvedAt set
  - [ ] Non-manager gets 403 when trying to approve
  - [ ] Returns 400 when approving non-`requested` grant
  - [ ] Manager can reject `requested` grant
  - [ ] Rejected grant has status `rejected`
  - [ ] Rejected grant has rejectionReason set
  - [ ] Non-manager gets 403 when trying to reject
  - [ ] Returns 400 when rejecting non-`requested` grant
  - [ ] GET /pending returns only grants where user is manager
  - [ ] GET /pending excludes non-`requested` grants
  - [ ] Pagination works on pending endpoint

## Dependencies

- PHASE2-001 (Status enum must exist)
- PHASE2-002 (Access requests must be creatable)

## Progress

- YYYY-MM-DD: Ticket created

## Notes

- Manager is determined by `user.managerId` field
- Consider notification trigger after approve/reject (PHASE2-006)
- After approval, grant needs system owner to provision (PHASE2-004)
