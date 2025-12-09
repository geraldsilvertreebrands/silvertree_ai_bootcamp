# PHASE2-004: User portal limited view and request flow

## Summary
Non-owner/users should only see their own access, request new access, and see request status/denials. They must NOT see owner-only pages like “Log Access” or audit logs.

## Goals
- Restrict UI for non-owners to a limited portal:
  - View only their grants (system, instance, tier, granted date, granted by).
  - See request history with status (requested/approved/rejected) and any denial message.
  - Create new access requests (Phase 2 workflow).
- Hide owner-only controls (Log Access, audit log, bulk upload, status updates) for non-owners.

## Requirements
- Auth role detection (reuse role mapping): owners keep full UI; regular users see limited portal.
- Grants list scoped to current user; includes grantedAt, grantedBy, system/instance/tier.
- Requests list scoped to current user; shows status and rejection note if rejected.
- Access request form available to users; posts to `POST /api/v1/access-requests`.
- If request rejected, show denial message in the portal.
- Routing/navigation updated to prevent non-owners from seeing owner pages/sections.

## Non-Goals
- Slack notifications (separate ticket).
- System-owner approval UI (already in another ticket).
- Copy-grants helper (separate ticket).

## Acceptance Criteria
1) A non-owner logging in only sees their grants and requests; cannot see Log Access, Bulk Upload, or Audit Log pages/sections.
2) User can submit an access request; it appears in their request list as `requested`.
3) If a request is rejected, the user can see the rejection status (and note/message if provided).
4) Grants list for a user is correct and not leaking other users’ data.

## Testing
- Integration/e2e: non-owner cannot access owner-only endpoints/pages; requests are created and visible to requester; rejected requests show status (and note when available); grants list filtered to current user.*** End Patch``` Note this final text must include End Patch no extra.

