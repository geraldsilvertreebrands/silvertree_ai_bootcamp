# PHASE2-003: System Owner Approval for Access Requests

## Summary
Allow system owners to approve or reject access requests (and their items). Approved items create active grants (if not already active). Only system owners of the relevant system(s) may approve/reject.

## Goals
- System owners can view requests relevant to their systems.
- Approve/reject at request level (apply to all items) or per-item.
- Approved items create/ensure active grants; rejected items stay non-active.
- Authorization: only system owners for the item’s system can approve/reject it.

## Requirements
- Endpoints:
  - `GET /api/v1/access-requests?status=&systemId=&requesterId=&targetUserId=` (filter)
  - `PATCH /api/v1/access-requests/:id/approve` (optional note; applies to all approvable items)
  - `PATCH /api/v1/access-requests/:id/reject` (optional note)
  - `PATCH /api/v1/access-requests/:id/items/:itemId/approve`
  - `PATCH /api/v1/access-requests/:id/items/:itemId/reject`
- Statuses (requests/items): `requested`, `approved`, `rejected` (add `rejected`).
- Only system owners of the system for each item can approve/reject it.
- Approved → create active grant if not present (respect duplicate prevention).
- Responses include updated request with items and relations.

## Non-Goals
- Slack notifications (separate ticket).
- “to_remove” workflow (already handled separately for grants).

## Acceptance Criteria
1) System owner approves a request containing items they own → items/status become `approved`, active grants exist or are left unchanged if already active.
2) System owner rejects a request → items/status become `rejected`; no grants created.
3) Non-owners attempting to approve/reject receive 403.
4) Filtering endpoint returns requests by status/system/target/requester.

## Testing
- Integration: approve path (creates grants or skips duplicates), reject path (no grants), 403 for non-owner, filter by status/system.



