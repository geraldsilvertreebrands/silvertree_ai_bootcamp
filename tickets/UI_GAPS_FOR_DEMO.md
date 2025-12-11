# UI Gaps for Demo - What's Missing

## Current UI Status

### ✅ What EXISTS in UI:
1. **"Users" View** - User-centric view showing:
   - List of users
   - Each user's active grants (expandable)
   - Add/Edit/Delete grants per user
   - Delete user
   - Search users

2. **"Log Access" View** - Form to create single grant:
   - User dropdown
   - System dropdown
   - Instance dropdown (filtered by system)
   - Access Tier dropdown (filtered by system)
   - Submit button

3. **"Audit Log" View** - Shows audit entries:
   - List of actions (add, remove, edit, delete)
   - Color-coded by action type
   - Shows actor, target user, system details, timestamp

### ❌ What's MISSING from UI (Required for Demo):

## 1. Access Overview View (CRITICAL)

**PRD Requirement:** "A view listing all access grants with filtering and status management capabilities."

**Current Status:** API exists (`GET /api/v1/access-overview`) but NO UI.

**What's Needed:**
- [ ] New "Access Overview" tab in sidebar navigation
- [ ] Grant-centric table (not user-centric)
- [ ] Columns: User, System, Instance, Tier, Status, Granted Date, Granted By
- [ ] Filtering UI:
  - [ ] Filter by User (search input)
  - [ ] Filter by System (dropdown)
  - [ ] Filter by Instance (dropdown, filtered by system)
  - [ ] Filter by Tier (dropdown, filtered by system)
  - [ ] Filter by Status (Active/Removed/All)
- [ ] Sorting (click column headers)
- [ ] Pagination controls
- [ ] "Remove" button on each grant row (for active grants)
- [ ] Status change confirmation dialog

**Ticket:** PHASE1-015

**Priority:** 🔴 CRITICAL - This is the PRIMARY feature in PRD

---

## 2. Bulk Upload UI (HIGH PRIORITY)

**PRD Requirement:** "A fast way to log multiple access grants at once."

**Current Status:** No backend endpoint, no UI.

**What's Needed:**
- [ ] Backend: `POST /api/v1/access-grants/bulk` endpoint
- [ ] UI: Add bulk upload section to "Log Access" view:
  - [ ] Toggle: "Single Grant" vs "Bulk Upload"
  - [ ] Bulk form with dynamic rows:
    - [ ] Each row: User, System, Instance, Tier dropdowns
    - [ ] "Add Row" button
    - [ ] "Remove Row" button per row
  - [ ] "Upload All" button
  - [ ] Results display:
    - [ ] Success count
    - [ ] Failed count
    - [ ] Error list with row numbers

**Ticket:** PHASE1-014

**Priority:** 🟡 HIGH - Makes tool practical for real use

---

## 3. System Owner Authorization UI (OPTIONAL FOR DEMO)

**PRD Requirement:** "Only system owners can change grant statuses (for their systems)"

**Current Status:** No authorization checks (backend or UI).

**What's Needed:**
- [ ] Backend: SystemOwnerGuard (REQUIRED)
- [ ] UI: Optional for demo:
  - [ ] Fetch user's owned systems on login
  - [ ] Hide "Remove" buttons for non-owned systems
  - [ ] Show message: "You are not a system owner"

**Ticket:** PHASE1-013

**Priority:** 🟢 MEDIUM - Backend authorization sufficient for demo

---

## Summary

### Must Have for Demo:
1. ✅ **Access Overview UI** (PHASE1-015) - CRITICAL
2. ✅ **Bulk Upload UI** (PHASE1-014) - HIGH

### Nice to Have for Demo:
3. ⚠️ **System Owner Authorization UI** (PHASE1-013) - Backend-only OK

### Already Have:
- ✅ Users view (user-centric)
- ✅ Log Access form (single grant)
- ✅ Audit Log view

---

## Implementation Order for Demo:

1. **PHASE1-015: Access Overview UI** (Do this first!)
   - This is the PRIMARY feature
   - Shows all grants in one place
   - Enables filtering and status management

2. **PHASE1-014: Bulk Upload** (Do this second)
   - Makes logging practical
   - Shows scalability

3. **PHASE1-013: Authorization** (Backend-only OK for demo)
   - Security requirement
   - Can be backend-only for demo

---

## Notes

The current "Users" view is user-centric (shows users, then their grants). The PRD requires an "Access Overview" that is grant-centric (shows all grants in a table), which is what system owners need to review and manage access.

**For Demo:** Focus on Access Overview UI first, then Bulk Upload. Authorization can be backend-only.






