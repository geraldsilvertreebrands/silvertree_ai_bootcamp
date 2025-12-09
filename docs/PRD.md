# Product Requirements Document

## Overview

Internal SaaS tool for Silvertreebrand to manage staff access to systems across the organization. This tool enables system owners to quickly log, review, and manage access grants, ensuring accurate access records and supporting future automation.

## Phase 1: Corolla

### Goals

- Provide a fast, accurate way for system owners to record who has access to which systems
- Enable system owners to review all access grants with filtering capabilities
- Support bulk operations to minimize friction in logging access

### Core Concepts

#### User
- A staff member (Silvertreebrand employee)
- Has a unique email address
- Has exactly one manager (another user)
- Future: May sync from Zoho People or other HR systems

#### Manager
- Each user has exactly one manager (self-referential relationship)
- Manager is another user in the system
- Used for organizational hierarchy and future approval workflows

#### System
- A tool or platform used by the organization
- Examples: Acumatica, Magento, Google Analytics, Claude Code, etc.
- Has a name and optional description

#### System Instance
- A specific instance of a system
- Typically represents a brand, region, or environment
- Examples: "US Production", "EU Staging", "Brand A Acumatica"
- Belongs to exactly one System

#### Access Tier
- A label representing the level of access, specific to each System
- Examples: "read-only", "editor", "admin", "billing", etc.
- Defined per System (not per instance)
- Each System can have multiple Access Tiers

#### System Owner
- One or more users responsible for executing access changes in a given System
- System owners can log access grants and change grant statuses
- A user can be a system owner for multiple systems
- Ownership is at the System level (applies to all instances of that system)

#### Access Grant
- A record that a user has (or had) access to a System Instance with a specific Access Tier
- Contains:
  - User (grantee)
  - System Instance
  - Access Tier
  - Status (Phase 1: `active` or `removed` only)
  - Metadata: granted by (system owner), granted at, removed at
- Status values:
  - `active`: User currently has this access
  - `removed`: Access has been revoked (historical record)
  - Future phases: `requested`, `approved`, `to_remove`

### Features

#### 1. Access Overview

**Description:** A view listing all access grants with filtering and status management capabilities.

**Requirements:**
- Display all access grants in a table/list format
- Show: User name, System name, Instance name, Access Tier, Status, Granted date
- Filterable by:
  - User (search by name or email)
  - System (dropdown or search)
  - System Instance (dropdown or search)
  - Access Tier (dropdown)
  - Status (active/removed)
- System owners can change grant status (mark as `removed`)
- Pagination for large result sets
- Sortable columns

**Acceptance Criteria:**
- [ ] Page loads in <2 seconds with 1000+ grants
- [ ] All filters work independently and can be combined
- [ ] Only system owners can change grant statuses (for their systems)
- [ ] Status changes are logged in audit trail
- [ ] UI is responsive and works on desktop browsers

#### 2. Log Access Grant

**Description:** A form for system owners to log that they have granted access to a user.

**Requirements:**
- Form fields:
  - User (searchable dropdown or autocomplete)
  - System (dropdown)
  - System Instance (dropdown, filtered by selected System)
  - Access Tier (dropdown, filtered by selected System)
  - Status (defaults to `active`, can be changed)
- Validation:
  - User must exist
  - System Instance must belong to selected System
  - Access Tier must belong to selected System
  - Cannot create duplicate active grant (same user + instance + tier)
- Success feedback after submission
- Option to log another grant immediately (workflow optimization)

**Acceptance Criteria:**
- [ ] Form can be completed in <30 seconds
- [ ] All validations work correctly
- [ ] Duplicate active grants are prevented
- [ ] System owners can only log grants for systems they own
- [ ] Grant is immediately visible in Access Overview

#### 3. Bulk Grant Upload

**Description:** A fast way to log multiple access grants at once.

**Requirements:**
- Two options (choose one for Phase 1, or implement both):
  - **Option A:** CSV/Excel file upload
    - Template download available
    - Columns: User email, System name, Instance name, Access Tier name, Status
    - Validation and error reporting
    - Preview before import
  - **Option B:** In-browser spreadsheet-like grid editor
    - Add rows dynamically
    - Autocomplete for users, systems, instances, tiers
    - Batch validation
    - Submit all at once
- Error handling (implemented):
  - Show which rows failed and why
  - Allow partial imports (valid rows succeed, invalid rows are reported)
- Progress indicator for large imports
- Implementation notes (Phase 1 delivered):
  - CSV upload endpoint validates rows, prevents duplicate active grants, and returns per-row results
  - Missing users in CSV are created with derived names; systems/instances/tiers must already exist
  - Template download provided; sample/import-only users are not seeded (add via CSV)
  - Grid editor (JSON) also supported for bulk

**Acceptance Criteria:**
- [ ] Can import 50+ grants in <2 minutes
- [ ] Clear error messages for validation failures
- [ ] Partial imports work (valid rows succeed)
- [ ] System owners can only bulk import for systems they own
- [ ] All imported grants appear in Access Overview
- [x] Implemented in Phase 1 (CSV + grid) with per-row results and duplicate prevention

### Out of Scope (Phase 1)

- Authentication/SSO integration (use simple placeholder)
- Approval workflows (statuses beyond active/removed)
- HR system integration (Zoho People sync)
- Notifications (email/Slack)
- API for external systems
- Advanced reporting/analytics
- Multi-tenant support
- Role-based permissions within the application (beyond system owner concept)

### Assumptions

- **Scale:** ~15 users, 20-50 systems, hundreds to low thousands of access grants
- **Performance:** Page loads <2s, form submissions <1s
- **Compliance:** Basic audit trail required, no specific regulatory requirements
- **Deployment:** Docker for local dev, Kubernetes-ready for production
- **Browser Support:** Modern browsers (Chrome, Firefox, Safari, Edge - latest 2 versions)

