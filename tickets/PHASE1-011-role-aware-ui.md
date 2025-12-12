# PHASE1-011: Role-Aware UI (Demo/Test Page)

## Context
The current `test-api.html` is a raw tester. We need a demo-friendly UI that reflects intended roles and workflows (viewer/manager/owner/admin) while still remaining a simple static page.

## Acceptance Criteria
- [ ] Add a **Role selector** (Normal / Manager / System Owner / Admin) to toggle visible actions.
- [ ] **Access Overview section**:
  - [ ] Search box (“Search user / system / instance”)
  - [ ] Filters: User, System, Instance, Tier, Status
  - [ ] “My Team” quick filter (manager view) – filters users whose `managerId` matches selected manager/current user (client-side).
  - [ ] Table columns: User | Manager | System | Instance | Tier | Status | Owner(s) | Actions
  - [ ] Actions column only visible for owner/admin: mark removed / reactivate
- [ ] **Log Grant section** (owner/admin only):
  - [ ] User typeahead, System dropdown, Instance dropdown (filtered), Tier dropdown (filtered), optional Status (default active), optional GrantedAt
  - [ ] Success box after submit; optionally link to filter Overview by that user
- [ ] **Bulk Upload section** (owner/admin):
  - [ ] UI stub: file input + sample template link; results box (even if backend not implemented yet)
- [ ] **System Owners section** (owner/admin):
  - [ ] Assign owner (system + user dropdowns)
  - [ ] List owners for system
  - [ ] List systems owned by user
  - [ ] Remove owner
- [ ] Loading states + clear success/error boxes for every action
- [ ] Preserve existing API wiring to backend
- [ ] Keep styling minimal but clean for demo

## Out of Scope (Phase 1)
- Server-side auth/RBAC enforcement (UI only)
- Full bulk upload backend (can be stubbed)

## Tests
- **Manual (UI)**
  - [ ] Role selector hides/shows actions appropriately
  - [ ] My Team filter reduces overview to users whose manager matches selection
  - [ ] Actions column hidden for Normal/Manager; visible for Owner/Admin
  - [ ] Grant creation works end-to-end
  - [ ] Status update buttons work (owner/admin)
  - [ ] Owner assignment/listing works
  - [ ] Bulk upload section renders and accepts a file (stub response ok)
- **Automated:** Not required (static page)

## Dependencies
- PHASE1-006 (log grants)
- PHASE1-008 (system owners)
- PHASE1-009 (update status)

## Progress
- 2025-12-08: Ticket created







