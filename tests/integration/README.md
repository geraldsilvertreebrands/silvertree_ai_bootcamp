# Integration Tests

## Setup

Integration tests require:
1. PostgreSQL database running (via Docker Compose)
2. Environment variables set (via `.env` file)

## Running Integration Tests

```bash
# Start PostgreSQL
docker-compose up -d

# Run integration tests
npm run test:integration
```

## Test Files

- `database-connection.integration.spec.ts` - Tests database connectivity

