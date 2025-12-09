# PHASE1-002: Data Model and Database Migrations

## Context

Implement the core data model as TypeORM entities and create database migrations. This establishes the foundation for all other features.

## Acceptance Criteria

- [ ] TypeORM entities created for all core models:
  - [ ] User (with manager self-reference)
  - [ ] System
  - [ ] SystemInstance
  - [ ] AccessTier
  - [ ] SystemOwner
  - [ ] AccessGrant
- [ ] All relationships defined correctly (foreign keys, constraints)
- [ ] Database migrations created and can be run
- [ ] Unique constraints implemented:
  - [ ] User.email unique
  - [ ] (SystemInstance.systemId, SystemInstance.name) unique
  - [ ] (AccessTier.systemId, AccessTier.name) unique
  - [ ] (SystemOwner.userId, SystemOwner.systemId) unique
  - [ ] (AccessGrant.userId, AccessGrant.systemInstanceId, AccessGrant.accessTierId, status='active') unique
- [ ] Indexes created for performance:
  - [ ] users.email
  - [ ] users.managerId
  - [ ] access_grants.userId
  - [ ] access_grants.systemInstanceId
  - [ ] access_grants.status
- [ ] Seed data script for development (optional but recommended)
- [ ] Migration can be rolled back
- [ ] All entities have proper TypeScript types

## Technical Approach

1. Create entity files in appropriate modules:
   - `src/identity/entities/user.entity.ts`
   - `src/systems/entities/system.entity.ts`
   - `src/systems/entities/system-instance.entity.ts`
   - `src/systems/entities/access-tier.entity.ts`
   - `src/ownership/entities/system-owner.entity.ts`
   - `src/access-control/entities/access-grant.entity.ts`
2. Define relationships using TypeORM decorators
3. Add constraints and indexes
4. Generate initial migration: `npm run migration:generate`
5. Create seed script for development data
6. Test migration up and down

## Tests

- **Unit:** Entity validation, relationship tests
- **Integration:** 
  - [ ] Migration runs successfully
  - [ ] Migration rolls back successfully
  - [ ] Entities can be created and relationships work
  - [ ] Unique constraints prevent duplicates
  - [ ] Foreign key constraints work
- **E2E:** None

## Dependencies

- PHASE1-001 (project setup must be complete)

## Progress

- 2024-12-19: Ticket created
- 2024-12-19: Implementation complete
  - ✅ Created all TypeORM entities:
    - User (with manager self-reference)
    - System
    - SystemInstance
    - AccessTier
    - SystemOwner
    - AccessGrant
  - ✅ All relationships defined with foreign keys
  - ✅ Unique constraints implemented:
    - User.email unique
    - (SystemInstance.systemId, SystemInstance.name) unique
    - (AccessTier.systemId, AccessTier.name) unique
    - (SystemOwner.userId, SystemOwner.systemId) unique
    - (AccessGrant.userId, systemInstanceId, accessTierId, status='active') unique (partial index)
  - ✅ Indexes created for performance:
    - users.email (unique)
    - users.managerId
    - access_grants.userId
    - access_grants.systemInstanceId
    - access_grants.status
  - ✅ Database migration created: `1764960871342-InitialSchema.ts`
  - ✅ Migration tested: runs successfully and can be reverted
  - ✅ Integration tests written and passing (13 tests)
  - ✅ Entities registered in AppModule
  - ✅ All tests passing (16/16)

