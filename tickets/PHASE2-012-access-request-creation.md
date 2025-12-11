# PHASE2-012: Access Request Creation (auto-approve if manager)

## Summary
Allow creation of access requests for a user across one or more system instances/tiers. If the requester is the target user’s manager, auto-approve and create active grants; otherwise, requests remain in `requested` status.

## Goals
- Create access requests with multiple items (systemInstance + accessTier).
- Auto-approve when requester is the target user’s manager, creating active grants.
- Otherwise, set items to `requested` and do not create grants.
- Record requester and target user.

## Requirements
- New entities: `AccessRequest` and `AccessRequestItem`.
- Request statuses: `requested`, `approved` (scope of this ticket).
- API: `POST /api/v1/access-requests` with payload `{ targetUserId, note?, items[] }`.
- Items: `{ systemInstanceId, accessTierId }`.
- Manager auto-approval:
  - If requester is target’s manager, set request/items to `approved`, create grants (status `active`), respecting duplicate prevention.
  - Else set to `requested`, no grants created.
- Response includes request and items (with status).

## Non-Goals
- System-owner approval UI/API.
- Slack notifications.
- Additional statuses (`rejected`, `to_remove` for requests).

## Acceptance Criteria
1) Manager requester → request/items `approved`; grants created as `active`; returns 201 with items.
2) Non-manager requester → request/items `requested`; no grants created; returns 201.
3) Duplicate active grants are skipped/ignored when auto-approving (request still succeeds; item notes duplicate).

## Testing
- Integration: manager auto-approve path creates grants; non-manager path leaves requested and no grants; duplicate grant scenario does not create a second active grant.



