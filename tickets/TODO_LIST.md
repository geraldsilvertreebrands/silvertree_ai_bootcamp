# TODO List - Tickets to Work On

## 🔴 CRITICAL - Must Have for Demo

### 1. PHASE1-015: Access Overview UI
**Status:** ❌ NOT STARTED  
**Priority:** 🔴 CRITICAL  
**File:** `tickets/PHASE1-015-access-overview-ui.md`

**What to do:**
- Add "Access Overview" tab to sidebar navigation
- Create grant-centric table view (not user-centric)
- Add filtering UI (User, System, Instance, Tier, Status)
- Add sorting (click column headers)
- Add pagination controls
- Add "Remove" button on each grant row
- Connect to existing API: `GET /api/v1/access-overview`

**Why critical:** This is the PRIMARY feature in PRD. Without this, demo won't show core functionality.

---

## 🟡 HIGH PRIORITY - Makes Tool Practical

### 2. PHASE1-014: Bulk Upload Implementation
**Status:** ❌ NOT STARTED  
**Priority:** 🟡 HIGH  
**File:** `tickets/PHASE1-014-bulk-upload-implementation.md`

**What to do:**
- **Backend:** Create `POST /api/v1/access-grants/bulk` endpoint
- **Backend:** Add `bulkCreate` method to AccessGrantService
- **UI:** Add bulk upload section to "Log Access" view
- **UI:** Create form with dynamic rows (Add/Remove rows)
- **UI:** Show results (success/failed counts, error details)

**Why high:** Makes logging practical for real-world use. PRD requirement.

---

## 🟢 MEDIUM PRIORITY - Security (Backend-Only OK for Demo)

### 3. PHASE1-013: System Owner Authorization
**Status:** ❌ NOT STARTED  
**Priority:** 🟢 MEDIUM  
**File:** `tickets/PHASE1-013-system-owner-authorization.md`

**What to do:**
- **Backend:** Create `SystemOwnerGuard`
- **Backend:** Create `@SystemOwner()` decorator
- **Backend:** Apply guard to grant creation/update endpoints
- **Backend:** Check user is system owner before allowing operations
- **UI:** Optional - can be backend-only for demo

**Why medium:** Security requirement, but backend-only is sufficient for demo.

---

## ✅ COMPLETED TICKETS (Reference Only)

- ✅ PHASE1-001: Project Setup
- ✅ PHASE1-002: Data Model & Migrations
- ✅ PHASE1-003: Identity Module
- ✅ PHASE1-004: Systems Module
- ✅ PHASE1-005: Access Overview API
- ✅ PHASE1-006: Log Access Grant API
- ✅ PHASE1-008: System Owner Management
- ✅ PHASE1-009: Update Grant Status API
- ✅ PHASE1-010: UI Test Improvements
- ✅ PHASE1-012: Basic Auth

---

## 📋 Implementation Order

**For Demo (Recommended):**

1. **PHASE1-015** - Access Overview UI (Do this FIRST!)
   - This is the PRIMARY feature
   - Shows all grants in one place
   - Enables filtering and status management
   - API already exists, just need UI

2. **PHASE1-014** - Bulk Upload (Do this SECOND)
   - Makes logging practical
   - Shows scalability
   - Need both backend and UI

3. **PHASE1-013** - Authorization (Do this THIRD)
   - Security requirement
   - Backend-only OK for demo
   - Can skip UI checks for now

---

## 📝 Notes

- **PHASE1-007** exists but is superseded by **PHASE1-014** (more detailed)
- **PHASE1-011** (Role-Aware UI) is lower priority, can be done later
- Focus on PHASE1-015 first - it's the most visible feature for demo

---

## 🎯 Quick Start

**To start working on PHASE1-015:**
1. Open `dashboard.html`
2. Add new nav item: "Access Overview"
3. Create `loadAccessOverviewView()` function
4. Fetch from `/api/v1/access-overview` with query params
5. Build table with filters, sorting, pagination
6. Add "Remove" buttons for status changes

**To start working on PHASE1-014:**
1. Create `BulkCreateAccessGrantsDto` in backend
2. Add `bulkCreate` method to `AccessGrantService`
3. Add `POST /api/v1/access-grants/bulk` endpoint
4. Add bulk upload UI to "Log Access" view
5. Create dynamic form rows

**To start working on PHASE1-013:**
1. Create `SystemOwnerGuard` in `src/common/guards/`
2. Create `@SystemOwner()` decorator
3. Apply guard to grant endpoints
4. Test authorization works




