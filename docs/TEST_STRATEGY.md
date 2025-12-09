# Test Strategy

## Testing Philosophy

**Test-Driven Development (TDD)** is mandatory for all feature work. We follow the red-green-refactor cycle:

1. Write a failing test that encodes acceptance criteria
2. Write minimal code to make the test pass
3. Refactor while keeping tests green
4. Repeat until all acceptance criteria are covered

## Test Types

### Unit Tests
- **Purpose:** Test individual functions, methods, services in isolation
- **Scope:** Business logic, domain models, utilities
- **Speed:** <100ms per test
- **Location:** `tests/unit/{module}/{service|entity}.spec.ts`
- **Mocking:** Mock all dependencies (database, external services)

### Integration Tests
- **Purpose:** Test workflows across multiple components (service + database + API)
- **Scope:** Critical user workflows, API endpoints, database operations
- **Priority coverage:** Bulk CSV upload (per-row validation, duplicate prevention, user creation from CSV), access overview visibility, auth/system-owner checks
- **Speed:** <1s per test
- **Location:** `tests/integration/{module}/{workflow}.integration.spec.ts`
- **Mocking:** Use real database (test database), mock external services

### End-to-End (E2E) Tests
- **Purpose:** Test complete user journeys through the UI
- **Scope:** Top 3-5 critical workflows
- **Speed:** <10s per test
- **Location:** `tests/e2e/{feature}.e2e.spec.ts`
- **Mocking:** Real database, real UI (Playwright/Cypress)

## Test Structure

```
tests/
  unit/
    identity/
      user.service.spec.ts
      manager.service.spec.ts
    systems/
      system.service.spec.ts
    access-control/
      access-grant.service.spec.ts
  integration/
    identity/
      user-creation.integration.spec.ts
    access-control/
      log-grant.integration.spec.ts
      access-overview.integration.spec.ts
      bulk-upload.integration.spec.ts
  e2e/
    access-overview.e2e.spec.ts
    log-access-grant.e2e.spec.ts
    bulk-upload.e2e.spec.ts
  fixtures/
    users.fixture.ts
    systems.fixture.ts
  factories/
    UserFactory.ts
    SystemFactory.ts
    AccessGrantFactory.ts
```

## Test Framework Stack

- **Framework:** Jest (built into NestJS)
- **HTTP Testing:** Supertest
- **E2E:** Playwright (or Cypress) - for Phase 2+
- **Coverage:** Istanbul/NYC (built into Jest)
- **Test Database:** PostgreSQL (separate from dev database)

## Naming Conventions

- **Unit tests:** `{entity}.spec.ts` (e.g., `user.service.spec.ts`)
- **Integration tests:** `{workflow}.integration.spec.ts` (e.g., `log-grant.integration.spec.ts`)
- **E2E tests:** `{feature}.e2e.spec.ts` (e.g., `access-overview.e2e.spec.ts`)
- **Test descriptions:** Use `describe()` and `it()` with clear, behavior-focused descriptions

## Test Commands

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run tests for specific file
npm test -- user.service.spec.ts
```

## TDD Workflow (Per Ticket)

1. **Read ticket acceptance criteria**
2. **Write failing test** that encodes one acceptance criterion
3. **Run test** - confirm it fails for the right reason
4. **Write minimal code** to make test pass
5. **Run test again** - verify it passes
6. **Run tests after EVERY code change** - never make code edits without running tests
7. **Refactor** if needed (tests should still pass)
8. **Repeat** for next acceptance criterion
9. **All tests pass** - ticket complete

**CRITICAL RULE:** The engineer (or AI assistant) MUST run tests themselves after every code change. Do not delegate test execution to others. Iterate: run tests → fix issues → run tests again → repeat until all pass.

## Integration Test Strategy

### Critical Flows to Test

1. **Log Access Grant**
   - Happy path: Create grant successfully
   - Validation: Duplicate active grant prevented
   - Authorization: Non-owner cannot create grant
   - Edge cases: Invalid system instance, invalid access tier

2. **Access Overview**
   - List all grants
   - Filter by user
   - Filter by system
   - Filter by instance
   - Filter by access tier
   - Filter by status
   - Combined filters
   - Pagination
   - Status change (mark as removed)

3. **Bulk Upload**
   - Valid CSV import
   - Invalid rows reported correctly
   - Partial import (valid rows succeed)
   - Authorization: Only for owned systems

4. **User Management**
   - Create user with manager
   - Manager hierarchy validation

### Test Database Setup

- Use separate PostgreSQL database for tests
- Reset database between test suites:
  - Option 1: Transactions (rollback after each test)
  - Option 2: Truncate tables between suites
- Use factories/fixtures for test data
- Seed common data (systems, users) in `beforeAll`

## Test Maintainability

### Best Practices

1. **Test Behavior, Not Implementation**
   - Don't test internal methods unless they're public API
   - Focus on inputs and outputs
   - Test "what" not "how"

2. **Use Factories for Test Data**
   ```typescript
   const user = UserFactory.create({ email: 'test@example.com' });
   const system = SystemFactory.create({ name: 'Acumatica' });
   ```

3. **Arrange-Act-Assert Pattern**
   ```typescript
   it('should create access grant', async () => {
     // Arrange
     const user = await UserFactory.create();
     const system = await SystemFactory.create();
     const instance = await SystemInstanceFactory.create({ systemId: system.id });
     
     // Act
     const grant = await accessGrantService.create({
       userId: user.id,
       systemInstanceId: instance.id,
       accessTierId: tier.id,
     });
     
     // Assert
     expect(grant.status).toBe('active');
     expect(grant.userId).toBe(user.id);
   });
   ```

4. **Keep Tests Independent**
   - Each test should be able to run in isolation
   - Don't rely on test execution order
   - Clean up after each test

5. **Mock External Dependencies**
   - Mock external APIs
   - Use test database (not production)
   - Mock file system operations if needed

6. **Fast Tests**
   - Unit tests: <100ms each
   - Integration tests: <1s each
   - E2E tests: <10s each
   - If tests are slow, optimize or split

## Coverage Goals

- **Unit Tests:** 80%+ coverage for services and domain logic
- **Integration Tests:** 100% coverage of critical workflows
- **E2E Tests:** Top 3-5 user journeys (Phase 1+)

## Test Data Management

### Factories

Create factories for each entity to generate test data:

```typescript
// tests/factories/UserFactory.ts
export class UserFactory {
  static create(overrides?: Partial<User>): User {
    return {
      id: uuidv4(),
      email: `user-${Date.now()}@example.com`,
      name: 'Test User',
      managerId: null,
      ...overrides,
    };
  }
}
```

### Fixtures

Use fixtures for common test data that's shared across tests:

```typescript
// tests/fixtures/systems.fixture.ts
export const SYSTEMS = {
  ACUMATICA: { name: 'Acumatica', description: 'ERP System' },
  MAGENTO: { name: 'Magento', description: 'E-commerce Platform' },
};
```

## Continuous Integration

- Run all tests on every commit (via CI)
- Fail build if tests fail
- Generate coverage reports
- Enforce minimum coverage threshold (80%)

## Common Test Patterns

### Testing Services

```typescript
describe('AccessGrantService', () => {
  let service: AccessGrantService;
  let repository: Repository<AccessGrant>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AccessGrantService,
        {
          provide: getRepositoryToken(AccessGrant),
          useValue: mockRepository,
        },
      ],
    }).compile();
    service = module.get<AccessGrantService>(AccessGrantService);
  });

  it('should create access grant', async () => {
    // Test implementation
  });
});
```

### Testing Controllers

```typescript
describe('AccessGrantsController', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AccessGrantsController],
      providers: [AccessGrantService, /* mocks */],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  it('POST /api/v1/access-grants', () => {
    return request(app.getHttpServer())
      .post('/api/v1/access-grants')
      .send({ /* data */ })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
      });
  });
});
```

## Definition of Done (Testing)

A ticket is only complete when:
- [ ] All acceptance criteria have corresponding tests
- [ ] All tests pass
- [ ] Code coverage meets minimum threshold (80%)
- [ ] Tests are maintainable and follow patterns
- [ ] Integration tests cover critical workflows
- [ ] No flaky tests (tests that sometimes fail)

