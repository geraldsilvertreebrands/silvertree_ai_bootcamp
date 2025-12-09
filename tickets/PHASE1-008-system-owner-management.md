# PHASE1-008: System Owner Management

## Context

Not all users should be able to log access grants. Only "system owners" - users designated as responsible for a system - should manage access for their systems. Implement system owner assignment and use it to control who can log grants.

Note: SystemOwner entity already exists in data model, just need to expose via API.

## Acceptance Criteria

- [ ] API Endpoints:
  - [ ] `POST /api/v1/systems/:systemId/owners` - Assign user as system owner
  - [ ] `GET /api/v1/systems/:systemId/owners` - List owners for a system
  - [ ] `DELETE /api/v1/systems/:systemId/owners/:userId` - Remove system owner
  - [ ] `GET /api/v1/users/:userId/owned-systems` - List systems owned by user
- [ ] Validation:
  - [ ] System must exist
  - [ ] User must exist
  - [ ] Prevent duplicate ownership (same user, same system)
  - [ ] Cannot remove last owner (business rule, or allow it?)
- [ ] Response:
  - [ ] Return SystemOwner with user and system relations loaded
- [ ] Integration with Access Grants:
  - [ ] When logging grant, verify user is owner of that system
  - [ ] Return 403 Forbidden if not owner
  - [ ] (For Phase 1, can skip authorization and just track ownership)

## Technical Approach

1. Create SystemOwnerService with CRUD methods
2. Add endpoints to SystemsController or create SystemOwnersController
3. Create DTOs: AssignSystemOwnerDto
4. Implement validation (check user/system existence)
5. Implement duplicate prevention (unique constraint already in DB)
6. Add authorization check to grant creation (Phase 1: optional)

## Tests

- **Unit:**
  - [ ] SystemOwnerService.assign validates user exists
  - [ ] SystemOwnerService.assign validates system exists
  - [ ] SystemOwnerService.assign prevents duplicates
  - [ ] SystemOwnerService.remove works
- **Integration:**
  - [ ] POST /systems/:id/owners assigns owner
  - [ ] GET /systems/:id/owners returns list
  - [ ] DELETE removes owner
  - [ ] GET /users/:id/owned-systems returns systems
  - [ ] Returns 404 when system doesn't exist
  - [ ] Returns 404 when user doesn't exist
  - [ ] Returns 409 when duplicate ownership
  - [ ] Can log grant only if owner (if auth implemented)
- **E2E:**
  - [ ] Assign user as owner, then log grant for that system

## Dependencies

- PHASE1-002 (SystemOwner entity exists)
- PHASE1-003 (users)
- PHASE1-004 (systems)

## Progress

- 2025-12-08: Ticket created
- 2025-12-08: ✅ COMPLETE
  - Created AssignSystemOwnerDto with validation
  - Created SystemOwnerService with full CRUD:
    - assign: Validates user/system exist, prevents duplicates
    - findBySystem: Lists all owners for a system
    - findByUser: Lists all systems owned by a user
    - remove: Removes ownership
  - Created SystemOwnersController with endpoints:
    - POST /api/v1/systems/:systemId/owners
    - GET /api/v1/systems/:systemId/owners
    - DELETE /api/v1/systems/:systemId/owners/:userId
  - Created UserOwnedSystemsController with endpoint:
    - GET /api/v1/users/:userId/owned-systems
  - Created OwnershipModule
  - Updated AppModule to include OwnershipModule
  - Integration tests: 20 new tests, all passing
  - Manual testing: All endpoints work correctly
  - Total tests: 118 (up from 98)
  - Note: Authorization enforcement deferred to Phase 2

## Notes

**Phase 1 Scope Decision:** 
- Implement ownership tracking? YES (easy, entity exists)
- Enforce authorization? OPTIONAL (can punt to Phase 2)

For Phase 1, focus on tracking who owns what. Authorization enforcement can come later with proper auth system.

Consider: Should we allow a user to be owner of multiple systems? YES. Should a system have multiple owners? YES (team responsibility).

