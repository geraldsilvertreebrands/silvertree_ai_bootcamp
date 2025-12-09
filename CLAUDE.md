# Claude AI Instructions for Bootcamp Project

## Global Project Rules

This document contains instructions for AI assistants (Claude, Cursor AI) working on this codebase. These rules are **enforceable** and must be followed.

---

## Agent Commands (Slash Commands)

Use these specialized agents for different types of work. Type `/command` in Claude Code to activate.

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/plan` | Design implementation plans | Multi-file changes, new features, architecture decisions |
| `/research` | Explore codebase (read-only) | Starting new work, investigating bugs, understanding patterns |
| `/testing` | Write tests (TDD) | **ALWAYS BEFORE implementation** - TDD is mandatory |
| `/backend` | NestJS implementation | API, services, entities, controllers |
| `/frontend` | UI development | HTML, CSS, JS interfaces |
| `/workflow` | Status management | Approval flows, status transitions (Phase 2) |
| `/integration` | External APIs | Slack, provisioning APIs (Phase 2-3) |
| `/docs` | Documentation updates | After completing features |

### Recommended Workflow

```
1. /plan       → Design the approach (for complex features)
2. /research   → Understand existing code
3. /testing    → Write failing tests FIRST
4. /backend    → Implement to pass tests
5. /frontend   → Build UI (if needed)
6. /docs       → Update documentation
```

---

## Phase 2: Rolls Royce (Workflows)

### Status State Machine
```
[requested] → (manager approves) → [approved] → (owner provisions) → [active]
                    ↓                                                    ↓
              [rejected]                    [to_remove] ← (mark for removal)
                                                   ↓
                                              [removed]
```

### Key Features
- **Access Request Workflow**: Users request access, managers approve
- **Auto-Approval**: If requester IS the manager → auto-approve to `approved`
- **Manual Approval**: If requester is NOT manager → create in `requested` status
- **Mark for Removal**: System owners can mark grants as `to_remove`
- **Copy Grants**: Copy access from existing team member (onboarding)

### Slack Notifications (Stub First)
- `requested` → Notify manager with approval link
- `approved` → Notify system owner(s) to provision
- `to_remove` → Notify system owner(s) to de-provision
- `rejected` → Notify requester with reason

### Integration Approach
Use **adapter pattern** with mock implementation first:
```typescript
// Interface → MockAdapter (dev) → SlackAdapter (prod)
// Feature flag: ENABLE_SLACK=true/false
```

---

## Phase 3: Self-Driving (Auto-Provisioning)

### Key Features
- For selected systems: auto-provision via API when `approved`
- For selected systems: auto-deprovision via API when `to_remove`
- Provisioning status tracking per grant
- Idempotent operations (safe to retry)

### Provisioning Adapter Pattern
```typescript
// Each system gets its own adapter:
// src/integrations/provisioning/adapters/acumatica.adapter.ts
// src/integrations/provisioning/adapters/magento.adapter.ts
// Feature flag per system: PROVISION_ACUMATICA=true
```

---

## Phase 2 & 3 Implementation Rules

- Always add migrations for schema changes; keep backward compatibility
- Use adapter pattern for all external integrations
- Feature flag all integrations (ENABLE_SLACK, PROVISION_*)
- Graceful degradation: don't fail grants if notifications fail
- Never hardcode secrets - use environment variables
- Update docs and tickets after completion

## TODO List Management (MANDATORY)

**Always use TODO lists for multi-step work:**
- Create TODOs at the start of any task with 3+ steps
- Keep exactly ONE item `in_progress` at a time
- Mark items `completed` immediately when done (don't batch)
- Update TODOs as new sub-tasks are discovered

**Example:**
```
1. [completed] Research existing grant workflow
2. [in_progress] Write failing tests for approval flow
3. [pending] Implement approval service method
4. [pending] Add API endpoint
5. [pending] Update documentation
```

---

## Agent Usage & Workflow (for Claude Code)

- **Always use TODO lists** for multi-step work; keep one item `in_progress`
- Before executing, restate Phase/Ticket/Mode per Response Structure
- Use `/research` agent to get context before implementing
- Run tests after EVERY code change (see Test Commands); report results explicitly
- For integrations (Slack/API), use adapter pattern with stubs first
- When touching workflows, preserve existing behaviors; add new statuses with migration
- Keep UI/UX changes in sync with backend contract; update fixtures/seeds if needed

## CRITICAL: Do NOT Code Unless Explicitly Told

**NEVER write production code, tests, or make implementation changes unless the user explicitly requests it.**

- Planning phases are for documentation, architecture, and design ONLY
- Do NOT create entities, services, controllers, or any implementation code during planning
- Do NOT run commands like `npm install`, `npm test`, or start services unless explicitly asked
- Only create documentation, tickets, configuration files (package.json, docker-compose.yml), and project structure during planning
- Wait for explicit "start coding", "begin implementation", or similar instruction before writing any code

**Exception:** Configuration files (package.json, tsconfig.json, docker-compose.yml) are acceptable in planning phase as they define the project setup, but actual application code is NOT.

## Project Context

This is an internal SaaS access management tool for Silvertreebrand. We follow strict engineering practices:
- Test-Driven Development (TDD) is mandatory
- All work is organized into Phases and Tickets
- Documentation is source of truth
- Production-quality code, not demos

## Before Starting Work

**ALWAYS read these files first:**
1. `docs/PRD.md` - Product requirements
2. `docs/ARCHITECTURE.md` - Technical architecture
3. `docs/TEST_STRATEGY.md` - Testing approach
4. `docs/PHASES.md` - Project phases
5. `docs/DECISIONS.md` - Architecture decisions
6. Current ticket file in `tickets/`

## Response Structure

Every non-trivial response MUST:

**Start with:**
- Phase: <name>
- Ticket: <ID and title, or "Multiple">
- Mode: PLANNING or EXECUTION
- Last status: (1-3 bullets)
- This iteration plan: (3-7 bullet steps)

**End with:**
- Changes made: (file paths)
- Tests: (commands run, pass/fail)
- Progress updates: (ticket progress, PROGRESS.md entry)
- Open questions: (if any)

## TDD Workflow (NON-NEGOTIABLE)

For every ticket:

1. **Read acceptance criteria** from ticket
2. **Write failing test** that encodes acceptance criteria
3. **Run test** - confirm it fails
4. **Write minimal code** to make test pass
5. **Run test again** - verify it passes
6. **Refactor** if needed
7. **Run tests after EVERY code change** - never make code changes without running tests
8. **Repeat** until all acceptance criteria covered

**Completion Rules:**
- Ticket is NOT complete until ALL tests pass
- **YOU MUST RUN TESTS YOURSELF** - do not ask user to run tests
- Run tests after EVERY code edit you make
- Must state which tests were run and confirm they passed
- Never skip tests or mark "done" with failing tests
- If tests fail, fix the issues immediately and re-run until they pass
- Iterate: run tests → fix issues → run tests again → repeat until passing
- **If Node.js/npm is not available in environment:** Document this clearly, but tests must still be verified before ticket completion. Attempt to find Node.js via nvm, homebrew, or other means. If truly unavailable, note in ticket progress that manual verification is needed, but this should be rare.

## Test Commands

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run with coverage
npm run test:cov

# Watch mode
npm run test:watch
```

## Code Style

- **Language:** TypeScript (strict mode)
- **Framework:** NestJS
- **Formatting:** Prettier (run `npm run format`)
- **Linting:** ESLint (run `npm run lint`)
- **Type Safety:** No `any` types unless absolutely necessary

## Documentation Updates

When making changes:

- **Requirements change:** Update `docs/PRD.md`
- **Architecture change:** Update `docs/ARCHITECTURE.md`
- **Test approach change:** Update `docs/TEST_STRATEGY.md`
- **Decision made:** Add entry to `docs/DECISIONS.md`
- **Progress:** Update ticket `## Progress` section and `PROGRESS.md`

## Do NOT Touch (Without Explicit Permission)

- CI/CD configuration (`.github/workflows/`, etc.)
- Kubernetes manifests and Helm charts (in `infra/k8s/`)
- Production infrastructure definitions
- Database migrations that are already in production (only add new ones)

## Ticket Workflow

1. Read ticket file from `tickets/`
2. Understand acceptance criteria
3. Follow TDD workflow
4. Update ticket `## Progress` section with dated entries
5. Update `PROGRESS.md` when ticket complete

## Progress Logging Format

**In ticket file:**
```markdown
## Progress
- YYYY-MM-DD: Started implementation
- YYYY-MM-DD: Tests written, all passing
- YYYY-MM-DD: Implementation complete, ready for review
```

**In PROGRESS.md:**
```markdown
## YYYY-MM-DD
- PHASE1-001: Project setup complete
```

## Error Handling

If tests fail after 3 different approaches:
- Stop making code changes
- Document what was tried
- Explain why it failed
- Propose 2-3 alternative strategies
- Ask specific questions if human input needed

## Definition of Done

A ticket is complete when:
- [ ] All acceptance criteria met
- [ ] All tests pass
- [ ] Relevant docs updated
- [ ] Ticket progress section updated
- [ ] PROGRESS.md updated
- [ ] Code reviewed (if applicable)

## Default Assumptions

- **Scale:** ~15 users, 20-50 systems, hundreds to low thousands of grants
- **Performance:** <2s page loads, <1s API responses
- **Browser:** Modern browsers (latest 2 versions)
- **Deployment:** Docker for local, Kubernetes-ready for production

## Questions to Ask

If unclear about:
- Requirements → Check PRD.md first, then ask
- Architecture → Check ARCHITECTURE.md first, then ask
- Testing → Check TEST_STRATEGY.md first, then ask
- Decisions → Check DECISIONS.md first, then ask

## Module Structure

Follow NestJS module structure:
```
src/
  {module}/
    entities/
    dto/
    services/
    controllers/
    tests/
```

Keep modules loosely coupled. Use dependency injection.

## Common Patterns

- **Services:** Business logic
- **Controllers:** HTTP endpoints
- **DTOs:** Request/response validation
- **Entities:** TypeORM domain models
- **Guards:** Authorization
- **Interceptors:** Logging, transformation

---

## Best Practices for Using Claude Code

### 1. Start with Research
```bash
/research  # Understand the codebase before changing anything
```

### 2. Use Plan Mode for Complex Features
- Press **Shift+Tab** to toggle Plan Mode
- Or use `/plan` agent command
- Get approval before implementing

### 3. Follow TDD Strictly
```bash
/testing   # Write failing tests FIRST
npm test   # Run after EVERY code change
```

### 4. Use TODO Lists
- Create at start of multi-step work
- Keep exactly ONE item in_progress
- Mark complete immediately when done

### 5. Model Selection
- **opusplan**: Best for architecture/planning (Opus for planning, Sonnet for execution)
- **opus**: Full power for complex tasks
- **sonnet**: Fast execution for straightforward tasks

### 6. Keyboard Shortcuts (Mac)
- **Shift+Tab**: Toggle Plan Mode
- **Cmd+K**: Open command palette
- **Esc**: Cancel current operation

### 7. Agent Selection Guide

| Task | Agent | Notes |
|------|-------|-------|
| "Where is X handled?" | `/research` | Read-only exploration |
| "Add feature Y" | `/plan` → `/testing` → `/backend` | Full workflow |
| "Fix bug Z" | `/research` → `/testing` → `/backend` | Understand first |
| "Build UI for W" | `/frontend` | After backend is ready |
| "Add Slack notifications" | `/integration` | Use adapter pattern |
| "Document changes" | `/docs` | After implementation tested |

---

## Quick Reference

### Test Commands
```bash
npm test                    # All tests
npm run test:integration    # Integration only
npm run test:cov           # With coverage
```

### Common Locations
- **Entities:** `src/{module}/entities/`
- **Services:** `src/{module}/services/`
- **Controllers:** `src/{module}/controllers/`
- **DTOs:** `src/{module}/dto/`
- **Tests:** `tests/integration/`
- **Docs:** `docs/`

### Environment Variables (Phase 2-3)
```env
ENABLE_SLACK=false          # Slack notifications
SLACK_BOT_TOKEN=xoxb-...    # Slack API token
PROVISION_ACUMATICA=false   # Auto-provisioning
APP_BASE_URL=http://...     # For deep links
```

