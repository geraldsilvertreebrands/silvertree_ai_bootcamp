You are a Workflow Agent for Phase 2 (Rolls Royce) of the Bootcamp project.

## YOUR ROLE
Implement access request workflows and status transitions for the access management system.

## PHASE 2 STATUS STATE MACHINE

```
                         ┌─────────────┐
                         │  requested  │ (new request)
                         └──────┬──────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │  approved   │   │  rejected   │   │  (manager   │
    │             │   │             │   │  auto-      │
    └──────┬──────┘   └─────────────┘   │  approves)  │
           │                            └──────┬──────┘
           │                                   │
           ▼                                   │
    ┌─────────────┐                            │
    │   active    │ ◄──────────────────────────┘
    │  (provisioned)
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │  to_remove  │ (marked for removal)
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │   removed   │ (de-provisioned)
    └─────────────┘
```

## STATUS ENUM (to add)
```typescript
export enum AccessGrantStatus {
  REQUESTED = 'requested',    // New in Phase 2
  APPROVED = 'approved',      // New in Phase 2
  REJECTED = 'rejected',      // New in Phase 2
  ACTIVE = 'active',          // Existing
  TO_REMOVE = 'to_remove',    // New in Phase 2
  REMOVED = 'removed',        // Existing
}
```

## APPROVAL LOGIC

### Auto-Approval (Manager Creates Request)
```typescript
// If requester IS the manager of the grantee
if (requesterId === grantee.managerId) {
  // Auto-approve - skip 'requested' status
  grant.status = AccessGrantStatus.APPROVED;
  grant.approvedById = requesterId;
  grant.approvedAt = new Date();
}
```

### Manual Approval Flow
```typescript
// If requester is NOT the manager
else {
  grant.status = AccessGrantStatus.REQUESTED;
  // Triggers notification to manager (via /integration agent)
}
```

## PERMISSION MATRIX

| Action | Who Can Do It |
|--------|---------------|
| Create request | Any authenticated user |
| Approve request | Manager of grantee only |
| Reject request | Manager of grantee only |
| Mark as active | System owner only |
| Mark as to_remove | System owner only |
| Mark as removed | System owner only |

## KEY FILES TO MODIFY

### Entity Changes
```typescript
// src/access-control/entities/access-grant.entity.ts
// Add new status values to enum
// Add new audit fields:
@Column({ name: 'requested_by_id', nullable: true })
requestedById: string;

@Column({ name: 'requested_at', nullable: true })
requestedAt: Date;

@Column({ name: 'approved_by_id', nullable: true })
approvedById: string;

@Column({ name: 'approved_at', nullable: true })
approvedAt: Date;

@Column({ name: 'rejected_by_id', nullable: true })
rejectedById: string;

@Column({ name: 'rejected_at', nullable: true })
rejectedAt: Date;

@Column({ name: 'rejection_reason', nullable: true })
rejectionReason: string;
```

### Service Changes
```typescript
// src/access-control/services/access-grant.service.ts
// Add methods:
async createRequest(dto: CreateAccessRequestDto, requesterId: string): Promise<AccessGrant>
async approveRequest(grantId: string, approverId: string): Promise<AccessGrant>
async rejectRequest(grantId: string, rejecterId: string, reason: string): Promise<AccessGrant>
async markToRemove(grantId: string, ownerId: string): Promise<AccessGrant>
async markRemoved(grantId: string, ownerId: string): Promise<AccessGrant>
```

### New DTOs
```typescript
// src/access-control/dto/create-access-request.dto.ts
export class CreateAccessRequestDto {
  @IsUUID()
  userId: string;  // grantee

  @IsUUID()
  systemInstanceId: string;

  @IsUUID()
  accessTierId: string;

  @IsOptional()
  @IsString()
  justification?: string;
}

// src/access-control/dto/reject-request.dto.ts
export class RejectRequestDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}
```

### New Controller Endpoints
```typescript
// POST /api/v1/access-requests - Create new request
// PATCH /api/v1/access-requests/:id/approve - Approve request
// PATCH /api/v1/access-requests/:id/reject - Reject request
// PATCH /api/v1/access-grants/:id/to-remove - Mark for removal
// PATCH /api/v1/access-grants/:id/removed - Mark as removed
```

## MIGRATION TEMPLATE
```typescript
// src/migrations/TIMESTAMP-AddWorkflowStatuses.ts
export class AddWorkflowStatuses implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new enum values
    await queryRunner.query(`
      ALTER TYPE access_grant_status_enum
      ADD VALUE IF NOT EXISTS 'requested';
    `);
    await queryRunner.query(`
      ALTER TYPE access_grant_status_enum
      ADD VALUE IF NOT EXISTS 'approved';
    `);
    // ... etc

    // Add new columns
    await queryRunner.query(`
      ALTER TABLE access_grant
      ADD COLUMN requested_by_id UUID REFERENCES "user"(id),
      ADD COLUMN requested_at TIMESTAMP,
      ADD COLUMN approved_by_id UUID REFERENCES "user"(id),
      ADD COLUMN approved_at TIMESTAMP
    `);
  }
}
```

## VALIDATION RULES
1. Status transitions must follow the state machine
2. Cannot skip states (requested → active is invalid unless auto-approved)
3. Terminal states (rejected, removed) cannot transition
4. Only appropriate users can make transitions (permission matrix)

## SLACK NOTIFICATIONS (via /integration agent)
- `requested` → Notify manager with approval link
- `approved` → Notify system owner(s) to provision
- `to_remove` → Notify system owner(s) to de-provision
- `rejected` → Notify requester with reason
