# PHASE1-010: UI Test Page Improvements

## Context

The current test-api.html page only allows testing GET/POST endpoints for users and systems. Extend it to test the complete Phase 1 workflow including creating grants, updating status, and managing system owners.

This is a development/demo tool, not production UI. Focus on functionality over polish.

## Acceptance Criteria

- [ ] Add Section: System Owners
  - [ ] Assign user as system owner (dropdown for user, dropdown for system)
  - [ ] View owners for a system (dropdown to select system)
  - [ ] Remove owner (button to delete)
- [ ] Add Section: Access Grants
  - [ ] Create grant form:
    - [ ] User (dropdown or autocomplete)
    - [ ] System (dropdown)
    - [ ] Instance (dropdown, filtered by selected system)
    - [ ] Tier (dropdown, filtered by selected system)
    - [ ] Granted At (date picker, optional, defaults to now)
  - [ ] View grant details (show all relations)
- [ ] Add Section: Grant Status Management
  - [ ] Show grants with current status
  - [ ] Button to mark as removed
  - [ ] Button to reactivate
- [ ] Enhance Access Overview Section:
  - [ ] Add filters: user (search), system (dropdown), status (dropdown)
  - [ ] Show more details: tier, granted by, granted at
  - [ ] Format dates nicely
  - [ ] Add "Mark as Removed" button per grant
- [ ] Add Section: Bulk Upload (Optional)
  - [ ] File upload for CSV
  - [ ] Show upload results (success/failures)
  - [ ] Download CSV template button

## Technical Approach

1. Add new sections to test-api.html
2. Add JavaScript functions for new endpoints
3. Use fetch API for all requests
4. Add dropdowns populated from API
5. Add proper error handling and display
6. Show loading states
7. Format JSON responses nicely

## Tests

- **Manual Testing:**
  - [ ] Can create grant through UI
  - [ ] Can view grant in access overview
  - [ ] Can mark grant as removed
  - [ ] Can assign system owner
  - [ ] All buttons work
  - [ ] All dropdowns populate correctly
  - [ ] Error messages display clearly

## Dependencies

- PHASE1-006 (grant creation API)
- PHASE1-008 (system owner API)
- PHASE1-009 (status update API)

## Progress

- 2025-12-08: Ticket created
- 2025-12-08: ✅ COMPLETE
  - Enhanced `test-api.html` to cover full Phase 1 workflow:
    - Users: create + list
    - Systems: create + list
    - System owners: assign/list/remove; list systems by owner
    - Access grants: create with user/system/instance/tier dropdowns; optional grantedAt
    - Grant status: PATCH active/removed
    - Access overview: filters for user/system/status, pagination
  - Added dynamic dropdowns populated from live API (users, systems, instances, tiers)
  - Added loading states and clear success/error result boxes for every action
  - Tested manually: owner assignment, grant creation, status updates, overview filters
  - Backend tests remain green (118 integration tests passing)

## Notes

**Priority:** Medium - This is a developer tool, not user-facing UI.

**Alternative:** Could use Postman/Insomnia instead of HTML page, but HTML page is good for quick demos.

**Style:** Keep it simple, focus on functionality. Can use same styling as current page.

Consider adding:
- Validation feedback (highlight invalid fields)
- Success messages (green flash when action succeeds)
- Recent activity log (last 5 actions taken)
- Quick links (e.g., "Create grant for user X in system Y")

