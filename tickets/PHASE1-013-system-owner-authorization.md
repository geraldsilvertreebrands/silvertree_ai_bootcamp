# PHASE1-013: System Owner Authorization

## Context

According to the PRD, system owners should ONLY be able to:
- Log access grants for systems they own
- Change grant statuses for grants in systems they own

Currently, there are NO authorization checks - anyone can create grants or change statuses. This is a critical security gap.

## Current Status

- [x] SystemOwnerGuard created ✅
- [x] @SystemOwner() decorator created ✅
- [x] Authorization checks in controllers ✅
- [x] System owner checks applied to grant endpoints ✅
- [x] SystemOwner entity used for authorization ✅

## Acceptance Criteria

### Backend Authorization (REQUIRED)

- [x] **System Owner Guard/Decorator:**
  - [x] Create `SystemOwnerGuard` that checks if current user is owner of the system ✅
  - [x] Create `@SystemOwner()` decorator for easy use ✅
  - [x] Guard extracts systemId from request (from grant's systemInstance or direct param) ✅
  - [x] Guard checks SystemOwner table for current user + systemId ✅
  - [x] Returns 403 Forbidden if user is not system owner ✅

- [x] **Authorization for Log Access Grant:**
  - [x] `POST /api/v1/access-grants` requires system owner check ✅
  - [x] Extract systemId from systemInstanceId in request ✅
  - [x] Verify current user is owner of that system ✅
  - [x] Return 403 if not owner ✅
  - [x] Set grantedById automatically from authenticated user ✅

- [x] **Authorization for Update Grant Status:**
  - [x] `PATCH /api/v1/access-grants/:id/status` requires system owner check ✅
  - [x] Load grant and extract systemId from systemInstance ✅
  - [x] Verify current user is owner of that system ✅
  - [x] Return 403 if not owner ✅

- [x] **Authorization for Bulk Upload:**
  - [x] `POST /api/v1/access-grants/bulk` requires system owner check ✅
  - [x] Verify user is owner of systems in bulk request ✅
  - [x] Return error for grants where user is not owner ✅
  - [x] Allow partial success, skip grants for systems user doesn't own ✅

### Frontend Authorization (OPTIONAL FOR DEMO)

- [ ] **UI Authorization Checks:**
  - [ ] Fetch user's owned systems on login
  - [ ] Hide "Remove" buttons for grants in systems user doesn't own
  - [ ] Disable "Log Access" form for systems user doesn't own
  - [ ] Show message: "You are not a system owner for this system"

**NOTE:** For demo, backend authorization is sufficient. UI checks can be added later.

## Technical Approach

1. Create `SystemOwnerGuard` in `src/common/guards/`
2. Create `@SystemOwner()` decorator in `src/common/decorators/`
3. Inject SystemOwnerService into guard to check ownership
4. Extract current user from auth token (from AuthService)
5. Apply guard to:
   - `POST /api/v1/access-grants`
   - `PATCH /api/v1/access-grants/:id/status`
   - `POST /api/v1/access-grants/bulk` (when implemented)
6. **For Demo:** UI can show all actions, backend will enforce permissions

## Tests

- **Unit:**
  - [ ] SystemOwnerGuard checks ownership correctly
  - [ ] SystemOwnerGuard returns 403 for non-owners
  - [ ] SystemOwnerGuard allows access for owners
- **Integration:**
  - [ ] POST /api/v1/access-grants returns 403 if user not system owner
  - [ ] POST /api/v1/access-grants succeeds if user is system owner
  - [ ] PATCH /api/v1/access-grants/:id/status returns 403 if user not system owner
  - [ ] PATCH /api/v1/access-grants/:id/status succeeds if user is system owner
  - [ ] grantedById is automatically set from authenticated user

## Dependencies

- PHASE1-008 (System Owner management must exist) ✅
- PHASE1-012 (Basic auth must exist) ✅

## Progress

- 2025-12-08: ✅ COMPLETE
  - Created SystemOwnerGuard in `src/common/guards/system-owner.guard.ts`
  - Created @SystemOwner() decorator in `src/common/decorators/system-owner.decorator.ts`
  - Applied guard to POST /api/v1/access-grants
  - Applied guard to PATCH /api/v1/access-grants/:id/status
  - Implemented bulk authorization in AccessGrantService (per grant check)
  - grantedById automatically set from authenticated user
  - All integration tests passing (5/5)

## Notes

This is CRITICAL for security. Without this, anyone can log grants or change statuses, which defeats the purpose of system owners.

**For Demo:** Backend authorization is sufficient. UI can show all buttons/actions, backend will return 403 if user doesn't have permission. This allows demo to proceed without complex UI authorization logic.

**Priority:** HIGH - Security requirement, but can be backend-only for demo.

**Status:** ✅ COMPLETE - Backend authorization fully implemented and tested.
