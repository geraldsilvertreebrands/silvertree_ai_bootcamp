# PHASE2-001: Status Enum & Migration

## Context

Phase 2 introduces workflow-based access management. This requires expanding the AccessGrant status enum from `active|removed` to include workflow states: `requested`, `approved`, `rejected`, `to_remove`.

This is the **foundation ticket** - all other Phase 2 tickets depend on this.

## Acceptance Criteria

- [ ] **Database Migration:**
  - [ ] Add new enum values: `requested`, `approved`, `rejected`, `to_remove`
  - [ ] Migration is backward compatible (existing `active`/`removed` grants unchanged)
  - [ ] Migration can be rolled back safely

- [ ] **Entity Updates:**
  - [ ] Update AccessGrantStatus enum in entity
  - [ ] Add new audit fields:
    - `requestedById` (UUID, nullable)
    - `requestedAt` (timestamp, nullable)
    - `approvedById` (UUID, nullable)
    - `approvedAt` (timestamp, nullable)
    - `rejectedById` (UUID, nullable)
    - `rejectedAt` (timestamp, nullable)
    - `rejectionReason` (string, nullable, max 500 chars)
  - [ ] Add foreign key relationships for new `*ById` fields

- [ ] **DTO Updates:**
  - [ ] Update AccessGrantStatus enum in DTOs
  - [ ] UpdateAccessGrantStatusDto accepts new status values
  - [ ] Add validation for status transitions (preparation for next tickets)

- [ ] **Backward Compatibility:**
  - [ ] Existing API endpoints continue to work
  - [ ] Existing grants with `active`/`removed` status unchanged
  - [ ] Access overview shows all status types

## Technical Approach

### 1. Migration File
```typescript
// src/migrations/TIMESTAMP-AddWorkflowStatuses.ts
export class AddWorkflowStatuses implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new enum values
    await queryRunner.query(`
      ALTER TYPE access_grant_status_enum
      ADD VALUE IF NOT EXISTS 'requested'
    `);
    await queryRunner.query(`
      ALTER TYPE access_grant_status_enum
      ADD VALUE IF NOT EXISTS 'approved'
    `);
    await queryRunner.query(`
      ALTER TYPE access_grant_status_enum
      ADD VALUE IF NOT EXISTS 'rejected'
    `);
    await queryRunner.query(`
      ALTER TYPE access_grant_status_enum
      ADD VALUE IF NOT EXISTS 'to_remove'
    `);

    // Add audit columns
    await queryRunner.query(`
      ALTER TABLE access_grant
      ADD COLUMN IF NOT EXISTS requested_by_id UUID REFERENCES "user"(id),
      ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS approved_by_id UUID REFERENCES "user"(id),
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS rejected_by_id UUID REFERENCES "user"(id),
      ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(500)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing enum values
    // Drop columns only
    await queryRunner.query(`
      ALTER TABLE access_grant
      DROP COLUMN IF EXISTS requested_by_id,
      DROP COLUMN IF EXISTS requested_at,
      DROP COLUMN IF EXISTS approved_by_id,
      DROP COLUMN IF EXISTS approved_at,
      DROP COLUMN IF EXISTS rejected_by_id,
      DROP COLUMN IF EXISTS rejected_at,
      DROP COLUMN IF EXISTS rejection_reason
    `);
  }
}
```

### 2. Entity Update
```typescript
// src/access-control/entities/access-grant.entity.ts
export enum AccessGrantStatus {
  REQUESTED = 'requested',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ACTIVE = 'active',
  TO_REMOVE = 'to_remove',
  REMOVED = 'removed',
}

// Add new columns to entity
@ManyToOne(() => User, { nullable: true })
@JoinColumn({ name: 'requested_by_id' })
requestedBy: User;

@Column({ name: 'requested_by_id', nullable: true })
requestedById: string;

@Column({ name: 'requested_at', nullable: true })
requestedAt: Date;

// ... similar for approved, rejected
```

## Agents to Use

| Step | Agent | Purpose |
|------|-------|---------|
| 1 | `/research` | Understand current entity and migration structure |
| 2 | `/testing` | Write failing tests for new statuses |
| 3 | `/backend` | Create migration and update entity |
| 4 | `/backend` | Update DTOs and validation |
| 5 | `/testing` | Verify all tests pass |

## Tests

- **Integration:**
  - [ ] Migration runs successfully
  - [ ] Existing grants with `active` status unchanged
  - [ ] Existing grants with `removed` status unchanged
  - [ ] Can create grant with `requested` status
  - [ ] Can create grant with `approved` status
  - [ ] Access overview returns grants with all status types
  - [ ] New audit fields are nullable and work correctly
  - [ ] Foreign key constraints work for new `*ById` fields

## Dependencies

- None (foundation ticket)

## Progress

- YYYY-MM-DD: Ticket created

## Notes

- PostgreSQL doesn't allow removing enum values, so rollback only drops columns
- Keep `active` as default status for backward compatibility
- New status values will be used by subsequent tickets
- This ticket does NOT implement status transition logic (that's PHASE2-003+)
