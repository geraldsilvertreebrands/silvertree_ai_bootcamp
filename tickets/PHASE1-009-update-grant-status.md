# PHASE1-009: Update Access Grant Status

## Context

When someone leaves the company or changes roles, system owners need to mark access grants as "removed" to maintain accurate records. Implement status updates for access grants.

Phase 1 only supports "active" and "removed" statuses. Future phases will add "requested", "approved", "to_remove".

## Acceptance Criteria

- [ ] API Endpoint:
  - [ ] `PATCH /api/v1/access-grants/:id/status` - Update grant status
  - [ ] Request body: { status: 'active' | 'removed' }
  - [ ] When setting to 'removed', auto-populate removedAt timestamp
  - [ ] When setting back to 'active', clear removedAt timestamp
- [ ] Business Rules:
  - [ ] Can change from active → removed
  - [ ] Can change from removed → active (reactivate access)
  - [ ] Cannot create duplicate active grant (enforced by unique constraint)
  - [ ] Removing a grant sets removedAt to now (unless specified)
  - [ ] Activating a grant clears removedAt
- [ ] Response:
  - [ ] Return updated grant with all relations
  - [ ] Include updated status and removedAt
- [ ] Integration with Access Overview:
  - [ ] Grants can be filtered by status
  - [ ] Removed grants still appear in overview (historical record)
  - [ ] Can see when grant was removed (removedAt)
- [ ] Validation:
  - [ ] Grant must exist
  - [ ] Status must be valid enum value
  - [ ] 404 if grant doesn't exist
  - [ ] 400 if invalid status

## Technical Approach

1. Add updateStatus method to AccessGrantService
2. Add PATCH endpoint to AccessGrantController
3. Create UpdateAccessGrantStatusDto with validation
4. Implement logic to set/clear removedAt
5. Update grant and return with relations
6. Add error handling

## Tests

- **Unit:**
  - [ ] AccessGrantService.updateStatus changes status
  - [ ] Sets removedAt when status = removed
  - [ ] Clears removedAt when status = active
  - [ ] Validates status enum
- **Integration:**
  - [ ] PATCH /access-grants/:id/status updates status
  - [ ] Returns 404 if grant doesn't exist
  - [ ] Returns 400 if invalid status
  - [ ] Sets removedAt when marking as removed
  - [ ] Clears removedAt when reactivating
  - [ ] Updated grant appears in access overview with new status
  - [ ] Can filter access overview by status
- **E2E:**
  - [ ] Create grant → mark as removed → see in overview as removed
  - [ ] Filter overview to show only active grants

## Dependencies

- PHASE1-002 (AccessGrant entity with status field)
- PHASE1-005 (Access overview filters by status)
- PHASE1-006 (Grants exist to update)

## Progress

- 2025-12-08: Ticket created
- 2025-12-08: ✅ COMPLETE
  - Created UpdateAccessGrantStatusDto with status enum validation
  - Added updateStatus method to AccessGrantService:
    - Validates grant exists (404 if not)
    - Updates status
    - Sets removedAt when status = removed
    - Clears removedAt when status = active
    - Loads all relations in response
  - Added PATCH /api/v1/access-grants/:id/status endpoint
  - Integration tests: 7 new tests, all passing
  - Manual testing: Successfully tested active ↔ removed transitions
  - Total tests: 98 (up from 91)

## Notes

**Future Enhancement (Phase 2+):** 
- Add audit log for status changes
- Add "removedBy" field to track who removed access
- Add reason field for removal
- Workflow statuses: requested → approved → active → to_remove → removed

**Phase 1 Scope:**
- Keep it simple: just active ↔ removed
- System owner manually marks as removed when access is revoked
- Historical record preserved (grant still in DB, just marked removed)

This enables system owners to:
1. Log access when granted (create with status=active)
2. Mark access as removed when revoked (update status=removed)
3. View history of all access (active + removed) in overview

