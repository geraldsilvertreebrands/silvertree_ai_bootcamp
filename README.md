# Bootcamp - Access Management System

Internal SaaS tool for Silvertreebrand to manage staff access to systems across the organization.

## Tech Stack

- **Framework:** NestJS (Node.js/TypeScript)
- **Database:** PostgreSQL
- **ORM:** TypeORM
- **Testing:** Jest

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- npm

## Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Start PostgreSQL with Docker:**
   ```bash
   docker-compose up -d
   ```

3. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

4. **Run migrations:**
   ```bash
   npm run migration:run
   ```

5. **Start development server:**
   ```bash
   npm run start:dev
   ```

The API will be available at `http://localhost:3000`

## Development

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# With coverage
npm run test:cov

# Watch mode
npm run test:watch
```

### Code Quality

```bash
# Lint
npm run lint

# Format
npm run format
```

### Database Migrations

```bash
# Generate migration
npm run migration:generate -- src/migrations/MigrationName

# Run migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

## Project Structure

```
src/
  identity/          # User and Manager management
  systems/           # System, Instance, AccessTier management
  access-control/   # Access Grant management
  ownership/        # System Owner management
  audit/            # Audit logging
  common/           # Shared utilities
  config/           # Configuration
```

## Documentation

- [PRD](docs/PRD.md) - Product Requirements Document
- [Architecture](docs/ARCHITECTURE.md) - Technical architecture
- [Test Strategy](docs/TEST_STRATEGY.md) - Testing approach
- [Phases](docs/PHASES.md) - Project phases
- [Decisions](docs/DECISIONS.md) - Architecture Decision Records
- [Slack Setup](docs/SLACK_SETUP.md) - Slack integration setup guide

## Tickets

Work is organized into tickets under `tickets/`. See individual ticket files for details.

## Phase 1 (Corolla) Status

- [x] Planning and documentation
- [ ] Project setup (PHASE1-001)
- [ ] Data model and migrations (PHASE1-002)
- [ ] Identity module (PHASE1-003)
- [ ] Systems module (PHASE1-004)
- [ ] Access Overview (PHASE1-005)
- [ ] Log Access Grant (PHASE1-006)
- [ ] Bulk Upload (PHASE1-007)
- [ ] System Owner management (PHASE1-008)

## License

Internal use only - Silvertreebrand

