# PHASE2-011: Mark Grant "to remove"

## Summary
Allow system owners to mark an existing access grant for future removal by setting its status to `to_remove`.

## Goals
- Add Phase 2 status `to_remove` to access grants.
- Provide an API to update a grant status to `to_remove`.
- Ensure only system owners for the grant’s system can perform the update.
- Make the status visible in Access Overview.

## Requirements
- New status value: `to_remove` (in addition to `active`, `removed`).
- Endpoint: `PATCH /api/v1/access-grants/:id/status` accepts `to_remove`.
- Authorization: only system owners of the related system instance can set `to_remove`.
- Response includes updated grant with relations.
- Access Overview includes `to_remove` in filters/status values.

## Non-Goals
- Automatic removal scheduling.
- Slack notifications (covered in a separate ticket).

## Acceptance Criteria
1) Given a system owner, when they set a grant status to `to_remove`, the request succeeds (200) and the grant status is `to_remove`.
2) Non-system-owners receive 403 when attempting to set `to_remove`.
3) Access Overview returns grants with status `to_remove` when filtered by that status.
4) Validation prevents invalid statuses.

## Testing
- Integration: status update to `to_remove` by owner (200), by non-owner (403), and filtering in Access Overview shows `to_remove`.

