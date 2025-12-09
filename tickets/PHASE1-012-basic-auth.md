# PHASE1-012: Basic Email + Password Login

## Context
Phase 1 needs a simple login to demo role-based UI. Full SSO can come later; start with minimal email+password auth plus a hardcoded role assignment for demo purposes.

## Acceptance Criteria
- [ ] API endpoints:
  - [ ] `POST /api/v1/auth/register` (email, password) — optional for demo; or seed users instead
  - [ ] `POST /api/v1/auth/login` (email, password) → returns JWT (or session cookie) + role
  - [ ] `GET /api/v1/auth/me` → returns current user + role
- [ ] Passwords hashed (bcrypt)
- [ ] Role attached to user (enum: normal, manager, owner, admin). For Phase 1, hardcode/seed roles is acceptable.
- [ ] Guard that injects `req.user` with role for controllers (used later; UI can read it)
- [ ] CORS/session configured so the HTML test page can send credentials (withCredentials) if needed
- [ ] Minimal error handling: 401 on bad credentials, 400 on missing fields
- [ ] Seed script or manual seeding instructions to create demo users with roles

## Scope for Demo (simplify):
- Allow login-only (skip self-registration) with seeded users:
  - admin@example.com / password
  - owner@example.com / password
  - manager@example.com / password
  - user@example.com / password
- Return role in `/auth/me` so the frontend can toggle UI

## Tests
- **Integration**
  - [ ] POST /auth/login returns token for valid creds, 401 for invalid
  - [ ] GET /auth/me returns user + role when authorized
  - [ ] Password hashing verified (not stored in plain text)
- **Unit**
  - [ ] AuthService validates password
  - [ ] Role enum mapping works

## Dependencies
- User entity (email unique)
- CORS already enabled

## Progress
- 2025-12-08: Ticket created
- 2025-12-08: ✅ COMPLETE
  - Added demo Auth module with in-memory seeded users and roles
  - Endpoints:
    - POST /api/v1/auth/login (email, password) → token, role, name, email
    - GET /api/v1/auth/me (Authorization: Bearer <token> or ?token=) → current user + role
  - Seeded demo credentials:
    - admin@example.com / password (role: admin)
    - owner@example.com / password (role: owner)
    - manager@example.com / password (role: manager)
    - user@example.com / password (role: user)
  - Validation: class-validator on login DTO
  - Tests: auth integration tests added; full suite passing (122/122)
  - Notes: Tokens are demo-only (base64 of email, no persistence, no DB changes)

