# Phase 2: Rolls Royce - Overview

## Goal
Workflow-driven access management with approvals, notifications, and streamlined onboarding.

## Key Features

1. **Access Request Workflow** - Users can request access, managers approve
2. **Status State Machine** - `requested` → `approved` → `active` → `to_remove` → `removed`
3. **Manager Auto-Approval** - If requester is the manager, auto-approve
4. **Slack Notifications** - Notify relevant parties at each status change
5. **Copy Grants** - Copy access from existing team member for onboarding

## Status Values (Phase 2)

| Status | Description | Who Can Transition |
|--------|-------------|-------------------|
| `requested` | New request awaiting approval | Created by any user |
| `approved` | Manager approved, awaiting provisioning | Manager approves |
| `rejected` | Manager rejected the request | Manager rejects |
| `active` | Access provisioned and active | System owner marks done |
| `to_remove` | Marked for removal | System owner marks |
| `removed` | Access revoked | System owner marks done |

## Status State Machine

```
                    ┌──────────────┐
                    │   requested  │
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌─────────────┐
    │ approved │    │ rejected │    │ (auto-      │
    └────┬─────┘    └──────────┘    │  approve)   │
         │                          └──────┬──────┘
         │                                 │
         ▼                                 │
    ┌──────────┐                           │
    │  active  │ ◄─────────────────────────┘
    └────┬─────┘
         │
         ▼
    ┌──────────┐
    │to_remove │
    └────┬─────┘
         │
         ▼
    ┌──────────┐
    │ removed  │
    └──────────┘
```

## Tickets

| Ticket | Title | Priority | Dependencies | Agents |
|--------|-------|----------|--------------|--------|
| PHASE2-001 | Status Enum & Migration | P0 | None | `/backend`, `/testing` |
| PHASE2-002 | Access Request Creation | P0 | 001 | `/backend`, `/testing` |
| PHASE2-003 | Manager Approval Flow | P0 | 002 | `/workflow`, `/testing` |
| PHASE2-004 | System Owner Provisioning | P1 | 003 | `/workflow`, `/testing` |
| PHASE2-005 | Mark for Removal Flow | P1 | 004 | `/workflow`, `/testing` |
| PHASE2-006 | Notification Service (Stub) | P1 | 003 | `/integration`, `/testing` |
| PHASE2-007 | Copy Grants from User | P2 | 004 | `/backend`, `/testing` |
| PHASE2-008 | Request Workflow UI | P1 | 003, 006 | `/frontend` |
| PHASE2-009 | Approval Management UI | P1 | 003, 008 | `/frontend` |
| PHASE2-010 | Slack Integration (Real) | P2 | 006 | `/integration`, `/testing` |

## Implementation Order

```
Phase 2 Foundation (Week 1-2):
├── PHASE2-001: Status Enum & Migration
├── PHASE2-002: Access Request Creation
└── PHASE2-003: Manager Approval Flow

Phase 2 Workflows (Week 2-3):
├── PHASE2-004: System Owner Provisioning
├── PHASE2-005: Mark for Removal Flow
└── PHASE2-006: Notification Service (Stub)

Phase 2 Features (Week 3-4):
├── PHASE2-007: Copy Grants from User
├── PHASE2-008: Request Workflow UI
└── PHASE2-009: Approval Management UI

Phase 2 Integration (Week 4):
└── PHASE2-010: Slack Integration (Real)
```

## Technical Decisions

### Notification Approach
- **Stub first**: MockNotificationAdapter logs to console
- **Real later**: SlackNotificationAdapter with @slack/web-api
- **Feature flag**: `ENABLE_SLACK=true/false`

### Workflow Validation
- Status transitions enforced in service layer
- Invalid transitions return 400 Bad Request
- All transitions logged with timestamp and user

### Audit Fields (New)
```typescript
requestedById: string;
requestedAt: Date;
approvedById: string;
approvedAt: Date;
rejectedById: string;
rejectedAt: Date;
rejectionReason: string;
```

## Success Criteria

- [ ] Users can request access to systems
- [ ] Managers can approve/reject requests
- [ ] System owners can provision and mark removal
- [ ] Notifications sent at each status change (stub initially)
- [ ] Copy grants feature works for onboarding
- [ ] All workflows have 100% test coverage
- [ ] UI supports all workflow actions
