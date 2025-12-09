# PHASE1-006: Log Access Grant

## Context

Implement the core workflow for logging access grants. System owners need a quick, easy way to record when they grant access to a user. This is the PRIMARY feature that makes the Access Overview useful.

## Acceptance Criteria

- [ ] API Endpoint:
  - [ ] `POST /api/v1/access-grants` - Create a new access grant
  - [ ] Request body includes: userId, systemInstanceId, accessTierId, grantedAt (optional)
  - [ ] System sets status to 'active' by default
  - [ ] System records grantedById (from auth context, or passed in for Phase 1)
  - [ ] System records grantedAt (defaults to now)
- [ ] Validation:
  - [ ] User must exist
  - [ ] System instance must exist
  - [ ] Access tier must exist
  - [ ] Access tier must belong to the system of the instance
  - [ ] Prevent duplicate active grants (same user, instance, tier)
- [ ] Business Logic:
  - [ ] If duplicate active grant exists, return 409 Conflict
  - [ ] Allow multiple removed grants (historical records)
  - [ ] Auto-populate grantedAt if not provided
- [ ] Response:
  - [ ] Return created grant with all relations loaded
  - [ ] Include user, systemInstance (with system), accessTier, grantedBy
- [ ] Error Handling:
  - [ ] 400 for validation errors
  - [ ] 404 if user/instance/tier not found
  - [ ] 409 if duplicate active grant exists
  - [ ] 422 if tier doesn't match system

## Technical Approach

1. Create AccessGrantService with create method
2. Create AccessGrantController with POST endpoint
3. Create CreateAccessGrantDto with validation
4. Implement validation logic (check existence, check tier matches system)
5. Implement duplicate detection
6. Create integration with existing entities
7. Add proper error handling and error messages

## Tests

- **Unit:**
  - [ ] AccessGrantService.create validates user exists
  - [ ] AccessGrantService.create validates instance exists
  - [ ] AccessGrantService.create validates tier exists
  - [ ] AccessGrantService.create validates tier belongs to system
  - [ ] AccessGrantService.create prevents duplicate active grants
  - [ ] AccessGrantService.create allows removed grants
  - [ ] AccessGrantService.create sets defaults (status, grantedAt)
- **Integration:**
  - [ ] POST /api/v1/access-grants creates grant successfully
  - [ ] Returns 404 when user doesn't exist
  - [ ] Returns 404 when instance doesn't exist
  - [ ] Returns 404 when tier doesn't exist
  - [ ] Returns 422 when tier doesn't match system
  - [ ] Returns 409 when duplicate active grant exists
  - [ ] Allows creating grant with removed status
  - [ ] Response includes all relations
  - [ ] Access overview shows newly created grant
- **E2E:** 
  - [ ] Can create grant and see it in access overview

## Dependencies

- PHASE1-002 (data model with AccessGrant entity)
- PHASE1-003 (users exist)
- PHASE1-004 (systems, instances, tiers exist)
- PHASE1-005 (access overview to verify grants appear)

## Progress

- 2025-12-08: Ticket created
- 2025-12-08: ✅ COMPLETE
  - Created CreateAccessGrantDto with validation
  - Created AccessGrantService with full validation logic:
    - Validates user exists
    - Validates system instance exists
    - Validates access tier exists
    - Validates tier belongs to instance's system
    - Prevents duplicate active grants
    - Allows multiple removed grants
    - Sets default status (active) and grantedAt (now)
  - Created AccessGrantsController with POST endpoint
  - Updated AccessControlModule with new service/controller
  - All relations loaded in response (user, systemInstance, system, accessTier, grantedBy)
  - Integration tests: 13 new tests, all passing
  - Manual testing: Endpoint works, grants show in access overview
  - Total tests: 91 (up from 78)

## Notes

This is the CORE feature of Phase 1. Once this is implemented, the Access Overview becomes useful and system owners can start logging access.

Make it as simple and quick as possible - system owners should be able to log a grant in under 30 seconds.

