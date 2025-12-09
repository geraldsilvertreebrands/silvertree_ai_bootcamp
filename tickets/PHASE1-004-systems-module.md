# PHASE1-004: Systems Module (Systems, Instances, Access Tiers)

## Context

Implement the Systems module to manage systems, system instances, and access tiers. System owners will use these to log access grants.

## Acceptance Criteria

- [x] SystemService with CRUD operations:
  - [x] Create system
  - [x] Get system by ID
  - [x] List systems
  - [x] Update system
- [x] SystemInstanceService with CRUD operations:
  - [x] Create instance (belongs to system)
  - [x] Get instance by ID
  - [x] List instances for a system
  - [x] Update instance
  - [x] Validate instance name is unique per system
- [x] AccessTierService with CRUD operations:
  - [x] Create tier (belongs to system)
  - [x] Get tier by ID
  - [x] List tiers for a system
  - [x] Update tier
  - [x] Validate tier name is unique per system
- [x] Controllers with REST endpoints:
  - [x] `POST /api/v1/systems` - Create system
  - [x] `GET /api/v1/systems` - List systems
  - [x] `GET /api/v1/systems/:id` - Get system
  - [x] `PATCH /api/v1/systems/:id` - Update system
  - [x] `GET /api/v1/systems/:id/instances` - List instances
  - [x] `POST /api/v1/systems/:id/instances` - Create instance
  - [x] `GET /api/v1/systems/:id/access-tiers` - List tiers
  - [x] `POST /api/v1/systems/:id/access-tiers` - Create tier
- [x] DTOs with validation for all operations
- [x] Proper error handling

## Technical Approach

1. Create SystemService, SystemInstanceService, AccessTierService
2. Create DTOs with validation
3. Create controllers with endpoints
4. Implement uniqueness validation
5. Add error handling

## Tests

- **Unit:**
  - [x] SystemService creates system
  - [x] SystemInstanceService creates instance
  - [x] SystemInstanceService prevents duplicate names per system
  - [x] AccessTierService creates tier
  - [x] AccessTierService prevents duplicate names per system
- **Integration:**
  - [x] All CRUD endpoints work
  - [x] GET /api/v1/systems/:id/instances returns instances for system
  - [x] GET /api/v1/systems/:id/access-tiers returns tiers for system
  - [x] Duplicate names return 409 (ConflictException)
  - [x] Not found returns 404
- **E2E:** None

## Dependencies

- PHASE1-002 (data model must be complete)

## Progress

- 2024-12-19: Ticket created
- 2024-12-19: ✅ COMPLETE
  - Created all DTOs (6 files)
  - Created all services (3 files)
  - Created all controllers (3 files)
  - Created SystemsModule
  - Created custom exceptions (5 files)
  - Integration tests: 21 tests passing
  - All acceptance criteria met
  - All tests passing (65/65 total)

