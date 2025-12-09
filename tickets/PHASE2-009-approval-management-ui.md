# PHASE2-009: Approval Management UI

## Context

Managers need a UI to view and approve/reject access requests for their team members. System owners need a UI to view pending provisioning and removal tasks.

## Acceptance Criteria

- [ ] **Manager Approval Page:**
  - [ ] List all pending requests for manager's team
  - [ ] Show: requester, grantee, system, instance, tier, justification, date
  - [ ] Approve button with confirmation
  - [ ] Reject button with reason input
  - [ ] Bulk approve/reject options
  - [ ] Success/error feedback

- [ ] **System Owner Provisioning Page:**
  - [ ] List all approved grants pending provisioning
  - [ ] Show: user, system, instance, tier, approved by, approved date
  - [ ] "Mark Active" button
  - [ ] Bulk activate option
  - [ ] Filter by system

- [ ] **System Owner Removal Page:**
  - [ ] List all grants marked for removal
  - [ ] Show: user, system, instance, tier, marked date
  - [ ] "Confirm Removed" button
  - [ ] "Cancel Removal" button
  - [ ] Bulk remove option

- [ ] **Dashboard Integration:**
  - [ ] Add notification badges for pending items
  - [ ] "X pending approvals" for managers
  - [ ] "X pending provisioning" for system owners
  - [ ] "X pending removals" for system owners

## Technical Approach

### 1. Manager Approval Component
```html
<!-- approvals.html or section -->
<div class="approvals-page">
  <h2>Pending Approvals <span class="badge" id="approval-count">0</span></h2>

  <div class="bulk-actions" id="bulk-approval-actions" style="display: none;">
    <button onclick="bulkApprove()" class="btn btn-success">
      Approve Selected
    </button>
    <button onclick="bulkReject()" class="btn btn-danger">
      Reject Selected
    </button>
  </div>

  <table class="data-table">
    <thead>
      <tr>
        <th><input type="checkbox" id="select-all-approvals"></th>
        <th>Requester</th>
        <th>For User</th>
        <th>System</th>
        <th>Instance</th>
        <th>Access Level</th>
        <th>Justification</th>
        <th>Requested</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody id="approvals-table-body">
      <!-- Populated by JS -->
    </tbody>
  </table>

  <div id="no-approvals" class="empty-state" style="display: none;">
    <p>No pending approvals</p>
  </div>
</div>

<!-- Reject Modal -->
<div id="reject-modal" class="modal" style="display: none;">
  <div class="modal-content">
    <h3>Reject Request</h3>
    <form id="reject-form">
      <div class="form-group">
        <label>Reason for rejection *</label>
        <textarea id="reject-reason" required rows="3"
          placeholder="Please provide a reason..."></textarea>
      </div>
      <div class="modal-actions">
        <button type="button" onclick="closeRejectModal()" class="btn">
          Cancel
        </button>
        <button type="submit" class="btn btn-danger">
          Reject Request
        </button>
      </div>
    </form>
  </div>
</div>
```

### 2. JavaScript for Approvals
```javascript
// approvals.js
let pendingApprovals = [];
let selectedGrantId = null;

async function loadPendingApprovals() {
  try {
    const response = await fetch('/api/v1/access-requests/pending', {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    pendingApprovals = await response.json();
    renderApprovals();
    updateBadge();
  } catch (error) {
    showError('Failed to load pending approvals');
  }
}

function renderApprovals() {
  const tbody = document.getElementById('approvals-table-body');
  const noApprovals = document.getElementById('no-approvals');

  if (pendingApprovals.length === 0) {
    tbody.innerHTML = '';
    noApprovals.style.display = 'block';
    return;
  }

  noApprovals.style.display = 'none';
  tbody.innerHTML = pendingApprovals.map(grant => `
    <tr>
      <td><input type="checkbox" class="approval-checkbox" value="${grant.id}"></td>
      <td>${grant.requestedBy?.name || 'Unknown'}</td>
      <td>${grant.user.name}</td>
      <td>${grant.systemInstance.system.name}</td>
      <td>${grant.systemInstance.name}</td>
      <td>${grant.accessTier.name}</td>
      <td>${grant.justification || '-'}</td>
      <td>${formatDate(grant.requestedAt)}</td>
      <td>
        <button onclick="approveGrant('${grant.id}')" class="btn btn-sm btn-success">
          Approve
        </button>
        <button onclick="openRejectModal('${grant.id}')" class="btn btn-sm btn-danger">
          Reject
        </button>
      </td>
    </tr>
  `).join('');
}

async function approveGrant(grantId) {
  if (!confirm('Approve this access request?')) return;

  try {
    await fetch(`/api/v1/access-requests/${grantId}/approve`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    showSuccess('Request approved');
    loadPendingApprovals();
  } catch (error) {
    showError('Failed to approve request');
  }
}

function openRejectModal(grantId) {
  selectedGrantId = grantId;
  document.getElementById('reject-modal').style.display = 'flex';
}

document.getElementById('reject-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const reason = document.getElementById('reject-reason').value;

  try {
    await fetch(`/api/v1/access-requests/${selectedGrantId}/reject`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ reason }),
    });
    showSuccess('Request rejected');
    closeRejectModal();
    loadPendingApprovals();
  } catch (error) {
    showError('Failed to reject request');
  }
});
```

### 3. Provisioning Page Component
```html
<div class="provisioning-page">
  <h2>Pending Provisioning <span class="badge" id="provision-count">0</span></h2>

  <div class="filter-bar">
    <select id="system-filter">
      <option value="">All Systems</option>
    </select>
    <button onclick="bulkActivate()" class="btn btn-primary">
      Activate Selected
    </button>
  </div>

  <table class="data-table">
    <thead>
      <tr>
        <th><input type="checkbox" id="select-all-provision"></th>
        <th>User</th>
        <th>System</th>
        <th>Instance</th>
        <th>Access Level</th>
        <th>Approved By</th>
        <th>Approved Date</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody id="provision-table-body"></tbody>
  </table>
</div>
```

### 4. CSS for Modals and Badges
```css
.badge {
  background: #dc3545;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  margin-left: 8px;
}

.badge:empty, .badge[data-count="0"] {
  display: none;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 24px;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 16px;
}
```

## Agents to Use

| Step | Agent | Purpose |
|------|-------|---------|
| 1 | `/research` | Review existing UI patterns |
| 2 | `/frontend` | Create manager approval page |
| 3 | `/frontend` | Create provisioning page |
| 4 | `/frontend` | Create removal page |
| 5 | `/frontend` | Add dashboard badges |

## Tests

- **Manual Testing:**
  - [ ] Pending approvals loads correctly
  - [ ] Approve flow works with confirmation
  - [ ] Reject flow works with reason
  - [ ] Bulk approve works
  - [ ] Bulk reject works
  - [ ] Pending provisioning loads correctly
  - [ ] Activate button works
  - [ ] Bulk activate works
  - [ ] Pending removal loads correctly
  - [ ] Confirm removed works
  - [ ] Cancel removal works
  - [ ] Dashboard badges show correct counts
  - [ ] Badges update after actions

## Dependencies

- PHASE2-003 (Manager approval API must exist)
- PHASE2-004 (Provisioning API must exist)
- PHASE2-005 (Removal API must exist)
- PHASE2-008 (Request UI patterns established)

## Progress

- YYYY-MM-DD: Ticket created

## Notes

- Critical for workflow usability
- Must be intuitive for non-technical users
- Consider email links that deep-link to approval page
- Mobile responsiveness important for quick approvals
