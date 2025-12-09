# Quick Start Prompt for AI Assistant

Copy this prompt and paste it when starting work on a new project or ticket:

---

## Project Context

I'm building [PROJECT_NAME] using [TECH_STACK]. This project follows a structured workflow to ensure quality and maintainability.

### Project Structure

- **Documentation:** `docs/` contains PRD.md, ARCHITECTURE.md, TEST_STRATEGY.md, PHASES.md, DECISIONS.md
- **Cursor Rules:** `.cursor/rules/` contains architecture.mdc and tdd.mdc with project patterns
- **Tickets:** `tickets/` contains work organized into tickets with acceptance criteria
- **Code:** Follows modular structure with clear boundaries

### Mandatory Workflow

1. **TDD Always:** Write failing tests FIRST, then implement code to make them pass
2. **Run Tests After Every Change:** You MUST run tests yourself after every code edit. Do not ask me to run tests.
3. **Follow Patterns:** Read `.cursor/rules/` files and follow established patterns
4. **Read Documentation:** Check relevant docs/ files before implementing
5. **Update Progress:** Update ticket progress section as you work

### Testing Requirements

- **Unit Tests:** <100ms each, mock all dependencies
- **Integration Tests:** <1s each, use real database
- **Coverage:** 80%+ for services
- **Run tests after EVERY code change** - iterate until all pass

### When Working on a Ticket

1. Read the ticket file to understand acceptance criteria
2. Read relevant documentation (ARCHITECTURE.md, TEST_STRATEGY.md)
3. Read `.cursor/rules/` files for patterns
4. Write failing tests for acceptance criteria
5. Implement code to make tests pass
6. Run tests after every change
7. Refactor while keeping tests green
8. Update ticket progress section

### Error Handling

- If tests fail: Read error carefully, check test expectations, verify test data, run tests again
- After 3 failed attempts: Document the issue and ask for help
- Never skip tests or work around errors - fix them properly

### Completion Criteria

A ticket is complete when:
- All acceptance criteria met
- All tests pass (unit, integration, E2E)
- Code coverage meets threshold
- No linter errors
- Documentation updated
- Ticket progress updated

### Current Task

[Paste your current ticket or task description here]

Please follow the workflow above. Start by reading the relevant documentation and ticket, then proceed with TDD workflow.

---

## Customization Instructions

Replace the placeholders:
- `[PROJECT_NAME]` - Your project name
- `[TECH_STACK]` - Your technology stack (e.g., "NestJS/TypeScript", "Django/Python", "Rails/Ruby")
- `[Paste your current ticket or task description here]` - The specific task you're working on

You can also add project-specific rules or patterns after the "Current Task" section.




