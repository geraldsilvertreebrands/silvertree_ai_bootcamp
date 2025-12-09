# PHASE2-008: Request Workflow UI

## Context

Users need a UI to request access to systems. This includes a form to create requests, view their pending requests, and see the status of their requests.

## Acceptance Criteria

- [ ] **Access Request Form:**
  - [ ] Form to request access for self or another user
  - [ ] Searchable user dropdown (for managers requesting for team)
  - [ ] System dropdown (filtered by available systems)
  - [ ] Instance dropdown (filtered by selected system)
  - [ ] Access tier dropdown (filtered by selected system)
  - [ ] Optional justification text field
  - [ ] Submit button that calls `POST /api/v1/access-requests`
  - [ ] Success/error feedback

- [ ] **My Requests Page:**
  - [ ] List all requests created by current user
  - [ ] Show: grantee, system, instance, tier, status, dates
  - [ ] Filter by status
  - [ ] Sort by date
  - [ ] Status badges with colors

- [ ] **My Access Page:**
  - [ ] List all grants where current user is the grantee
  - [ ] Show: system, instance, tier, status, granted date
  - [ ] Filter by status
  - [ ] Group by system (optional)

- [ ] **Copy from User UI:**
  - [ ] "Copy access from team member" button/section
  - [ ] Select source user (team members only)
  - [ ] Preview grants that will be copied
  - [ ] Checkbox to include/exclude specific grants
  - [ ] Submit to copy selected grants

- [ ] **Status Display:**
  - [ ] Color-coded status badges
  - [ ] `requested` - yellow
  - [ ] `approved` - blue
  - [ ] `active` - green
  - [ ] `to_remove` - orange
  - [ ] `removed` - gray
  - [ ] `rejected` - red

## Technical Approach

### 1. Request Form Component
```html
<!-- request-access.html or section in dashboard -->
<div class="request-form">
  <h2>Request Access</h2>

  <form id="access-request-form">
    <div class="form-group">
      <label for="user-select">Request for *</label>
      <select id="user-select" required>
        <option value="">Select user...</option>
      </select>
      <small>Select yourself or a team member</small>
    </div>

    <div class="form-group">
      <label for="system-select">System *</label>
      <select id="system-select" required>
        <option value="">Select system...</option>
      </select>
    </div>

    <div class="form-group">
      <label for="instance-select">Instance *</label>
      <select id="instance-select" required disabled>
        <option value="">Select instance...</option>
      </select>
    </div>

    <div class="form-group">
      <label for="tier-select">Access Level *</label>
      <select id="tier-select" required disabled>
        <option value="">Select access level...</option>
      </select>
    </div>

    <div class="form-group">
      <label for="justification">Justification</label>
      <textarea id="justification" rows="3"
        placeholder="Why do you need this access?"></textarea>
    </div>

    <button type="submit" class="btn btn-primary">Submit Request</button>
  </form>
</div>
```

### 2. JavaScript Logic
```javascript
// request-access.js
document.getElementById('system-select').addEventListener('change', async (e) => {
  const systemId = e.target.value;

  // Load instances for selected system
  const instances = await fetch(`/api/v1/systems/${systemId}/instances`);
  populateSelect('instance-select', instances, 'Select instance...');
  document.getElementById('instance-select').disabled = false;

  // Load access tiers for selected system
  const tiers = await fetch(`/api/v1/systems/${systemId}/access-tiers`);
  populateSelect('tier-select', tiers, 'Select access level...');
  document.getElementById('tier-select').disabled = false;
});

document.getElementById('access-request-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    userId: document.getElementById('user-select').value,
    systemInstanceId: document.getElementById('instance-select').value,
    accessTierId: document.getElementById('tier-select').value,
    justification: document.getElementById('justification').value,
  };

  try {
    const response = await fetch('/api/v1/access-requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      const result = await response.json();
      showSuccess(result.status === 'approved'
        ? 'Request auto-approved! Awaiting provisioning.'
        : 'Request submitted! Awaiting manager approval.');
      resetForm();
    } else {
      const error = await response.json();
      showError(error.message);
    }
  } catch (error) {
    showError('Failed to submit request');
  }
});
```

### 3. Status Badge CSS
```css
.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-requested { background: #fef3cd; color: #856404; }
.status-approved { background: #cce5ff; color: #004085; }
.status-active { background: #d4edda; color: #155724; }
.status-to_remove { background: #fff3cd; color: #856404; }
.status-removed { background: #e2e3e5; color: #383d41; }
.status-rejected { background: #f8d7da; color: #721c24; }
```

## Agents to Use

| Step | Agent | Purpose |
|------|-------|---------|
| 1 | `/research` | Review existing dashboard.html patterns |
| 2 | `/frontend` | Create request form component |
| 3 | `/frontend` | Create my requests page |
| 4 | `/frontend` | Create my access page |
| 5 | `/frontend` | Add copy from user UI |

## Tests

- **Manual Testing:**
  - [ ] Request form loads users, systems, instances, tiers
  - [ ] Dropdowns cascade correctly (system → instance/tier)
  - [ ] Form submits successfully
  - [ ] Success message shows correct status
  - [ ] Error handling works
  - [ ] My requests shows correct data
  - [ ] My access shows correct data
  - [ ] Status badges display correctly
  - [ ] Copy from user flow works end-to-end

## Dependencies

- PHASE2-002 (Access request API must exist)
- PHASE2-007 (Copy grants API must exist)

## Progress

- YYYY-MM-DD: Ticket created

## Notes

- Match existing dashboard.html styling
- Use vanilla JS (no frameworks)
- Consider mobile responsiveness
- Loading states for all async operations
