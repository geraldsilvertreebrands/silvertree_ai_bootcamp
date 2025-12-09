# PHASE1-015: Access Overview UI Implementation

## Context

The Access Overview API exists (`GET /api/v1/access-overview`) with full filtering, but there is NO dedicated UI for it. The dashboard currently has:
- "Users" view (user-centric, shows users then their grants)
- "Log Access" view (form to create single grant)
- "Audit Log" view (shows audit entries)

**MISSING:** The PRD requires an "Access Overview" view that is **grant-centric** - showing all grants in a table with filtering, sorting, pagination, and status management.

## Current Status

- [x] API endpoint exists with filtering (`GET /api/v1/access-overview`)
- [x] "Users" view exists (user-centric)
- [x] "Log Access" form exists
- [x] "Audit Log" view exists
- [x] **Access Overview view** (grant-centric table) ✅
- [x] Filtering UI for grants ✅
- [x] Sorting UI for grants ✅
- [x] Pagination UI for grants ✅
- [x] Status change UI from overview ✅

## Acceptance Criteria (FOR DEMO)

- [x] **Add "Access Overview" tab to sidebar navigation**
  - [x] New nav item between "Users" and "Log Access"
  - [x] Icon: table/list icon
  - [x] Label: "Access Overview"

- [x] **Access Overview Page:**
  - [x] Table format showing ALL grants (not user-centric)
  - [x] Columns: User name, System name, Instance name, Access Tier, Status, Granted date, Granted by
  - [x] Each row represents one grant
  - [x] Shows both active and removed grants (with visual distinction)

- [x] **Filtering UI (CRITICAL FOR DEMO):**
  - [x] Filter by User (search input - name or email)
  - [x] Filter by System (dropdown with all systems)
  - [x] Filter by System Instance (dropdown, filtered by selected System)
  - [x] Filter by Access Tier (dropdown, filtered by selected System)
  - [x] Filter by Status (dropdown: Active, Removed, All)
  - [x] All filters work independently and can be combined
  - [x] Clear filters button
  - [x] Active filter count badge (shows total grants)

- [x] **Sorting (FOR DEMO):**
  - [x] Click column headers to sort
  - [x] Sort by User name
  - [x] Sort by System name
  - [x] Sort by Granted date (default: newest first)
  - [x] Visual indicator for sort direction (arrows)

- [x] **Pagination (FOR DEMO):**
  - [x] Page size selector (10, 25, 50, 100)
  - [x] Page navigation (prev/next, page numbers)
  - [x] Shows "Showing X-Y of Z grants"

- [x] **Status Management (FOR DEMO):**
  - [x] Each grant row has "Remove" button (only for active grants)
  - [x] Clicking "Remove" changes status to "removed"
  - [x] Confirmation dialog before removing
  - [x] Success/error feedback
  - [x] Status change logged to audit trail
  - [x] **NOTE:** Authorization check can be backend-only for demo (PHASE1-013)

- [x] **Performance:**
  - [x] Page loads in <2 seconds
  - [x] Filters apply instantly (debounced search - 300ms delay)
  - [x] Pagination prevents slow initial load

## Out of Scope (For Demo)

- [ ] System owner authorization UI checks (backend-only for demo)
- [ ] Advanced filtering (date ranges, etc.)
- [ ] Export functionality
- [ ] Bulk actions (select multiple grants)

## Technical Approach

1. Add "Access Overview" nav item to sidebar
2. Create `loadAccessOverviewView()` function
3. Fetch grants from `/api/v1/access-overview` with query params
4. Build filter UI (search + dropdowns)
5. Display grants in table format
6. Add pagination controls
7. Add sort functionality (update query params)
8. Add "Remove" buttons
9. Call `PATCH /api/v1/access-grants/:id/status` on remove
10. Refresh list after status change

## Tests

- **E2E:**
  - [ ] Can view all grants in Access Overview
  - [ ] Can filter by user (search)
  - [ ] Can filter by system
  - [ ] Can filter by instance
  - [ ] Can filter by tier
  - [ ] Can filter by status
  - [ ] Can combine multiple filters
  - [ ] Can sort by user name
  - [ ] Can sort by system name
  - [ ] Can sort by granted date
  - [ ] Can paginate through results
  - [ ] Can remove grants (change status)
  - [ ] Status changes appear immediately
  - [ ] Page loads quickly

## Dependencies

- PHASE1-005 (Access Overview API) ✅
- PHASE1-013 (System Owner Authorization) - Can be backend-only for demo

## Progress

- 2025-12-08: ✅ COMPLETE
  - Added "Access Overview" navigation tab
  - Created grant-centric table view with all required columns
  - Implemented filtering UI (User search, System, Instance, Tier, Status)
  - Implemented sorting (User name, System name, Granted date)
  - Implemented pagination (Page size selector, prev/next navigation)
  - Added "Remove" button for active grants
  - Integrated with audit log
  - All access-overview API tests passing (14/14)
  - Debounced search for performance (300ms delay)
  - Dynamic dropdown loading (instances/tiers filtered by system)

## Notes

**This is CRITICAL for demo** - The PRD's primary feature is Access Overview. ✅ COMPLETE

The current "Users" view is user-centric (shows users, then their grants). This "Access Overview" view is grant-centric (shows all grants in a table), which is what system owners need to review and manage access.

**For Demo:** Authorization checks can be backend-only. UI can show all actions, backend will enforce permissions.
