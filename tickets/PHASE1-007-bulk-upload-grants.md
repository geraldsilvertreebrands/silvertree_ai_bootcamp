# PHASE1-007: Bulk Upload Access Grants

## Context

System owners often need to log many access grants at once (e.g., onboarding a team, audit catch-up). Manually creating grants one-by-one is too slow. Provide a bulk upload mechanism to make logging SUPER quick and easy.

## Acceptance Criteria

### Option A: CSV/Spreadsheet Upload (Recommended for Phase 1)

- [ ] API Endpoint:
  - [ ] `POST /api/v1/access-grants/bulk` - Upload CSV file
  - [ ] Accepts CSV with columns: userEmail, systemName, instanceName, tierName, grantedAt (optional)
  - [ ] Validates entire file before processing any grants
  - [ ] Returns summary: total, successful, failed (with reasons)
- [ ] Validation:
  - [ ] File must be valid CSV format
  - [ ] Maximum file size (e.g., 1000 rows)
  - [ ] Validate each row (user exists, system exists, etc.)
  - [ ] Collect all errors before returning
- [ ] Processing:
  - [ ] Skip rows that would create duplicate active grants
  - [ ] Or flag them in the response
  - [ ] Process in transaction (all or nothing, OR best-effort)
- [ ] Response:
  - [ ] Success count
  - [ ] Failed count
  - [ ] List of failures with row number and reason
  - [ ] List of skipped grants (duplicates)

### Option B: JSON Bulk Endpoint (Simpler for Phase 1)

- [ ] API Endpoint:
  - [ ] `POST /api/v1/access-grants/bulk` - JSON array of grants
  - [ ] Request body: array of { userId, systemInstanceId, accessTierId, grantedAt }
  - [ ] Maximum array size (e.g., 100 grants)
- [ ] Validation:
  - [ ] Validate each grant in array
  - [ ] Collect all validation errors
- [ ] Processing:
  - [ ] Use transaction for all-or-nothing
  - [ ] Or best-effort: create what's valid, report failures
- [ ] Response:
  - [ ] Array of results: { success: boolean, grant?, error? }
  - [ ] Or summary with failures array

## Technical Approach

**For JSON Bulk (Simpler):**
1. Create BulkCreateAccessGrantsDto (array of CreateAccessGrantDto)
2. Add bulk endpoint to AccessGrantController
3. Implement AccessGrantService.bulkCreate
4. Validate all grants first
5. Use transaction to create all or rollback
6. Return detailed results

**For CSV Upload (More User-Friendly):**
1. Add multer for file upload
2. Create CSV parser
3. Map CSV columns to grant data
4. Lookup users/systems/instances/tiers by name/email
5. Validate and create grants
6. Return detailed report

## Tests

- **Unit:**
  - [ ] AccessGrantService.bulkCreate validates all grants
  - [ ] AccessGrantService.bulkCreate uses transaction
  - [ ] AccessGrantService.bulkCreate returns detailed results
  - [ ] CSV parser handles valid CSV
  - [ ] CSV parser rejects invalid CSV
- **Integration:**
  - [ ] POST /api/v1/access-grants/bulk creates multiple grants
  - [ ] Returns summary with success/failure counts
  - [ ] Validates all grants before creating any
  - [ ] Handles partial failures gracefully
  - [ ] Skips duplicate active grants
  - [ ] CSV upload works end-to-end
- **E2E:**
  - [ ] Upload CSV with 10 grants, all succeed
  - [ ] Upload CSV with some invalid rows, get detailed errors

## Dependencies

- PHASE1-006 (single grant creation must work first)

## Progress

- 2025-12-08: Ticket created
- 2025-12-09: ✅ COMPLETE (JSON Bulk Endpoint)
  - Created BulkCreateAccessGrantsDto with array validation (1-100 grants)
  - Created BulkCreateAccessGrantItemDto with lenient validation (allows invalid UUIDs through for detailed error messages)
  - Implemented AccessGrantService.bulkCreate with best-effort processing
  - Added POST /api/v1/access-grants/bulk endpoint
  - Handles partial failures gracefully (returns success/failed/skipped counts)
  - Skips duplicate active grants (reports as skipped, not error)
  - Returns detailed results with row numbers and error messages
  - Integration tests: 6 tests passing
  - Frontend UI: Grid editor fully implemented in dashboard.html
    - Toggle between "Single Grant" and "Bulk Upload" modes
    - Dynamic rows with "Add Row" / "Remove Row" functionality
    - User, System, Instance, Tier dropdowns per row
    - System data loading (instances/tiers) per row
    - Results display with success/failed/skipped counts
    - Detailed error messages per row
    - Audit log entries for successful grants

- 2025-12-09: ✅ COMPLETE (CSV File Upload - Option A)
  - Installed dependencies: multer, papaparse for CSV parsing
  - Created CsvParserService with CSV parsing and validation
  - Added POST /api/v1/access-grants/bulk/csv endpoint for file upload
  - Added GET /api/v1/access-grants/bulk/csv/template endpoint for template download
  - CSV parsing features:
    - Case-insensitive column header matching
    - Validates required columns (userEmail, systemName, instanceName, tierName)
    - Resolves users, systems, instances, tiers by name/email
    - Validates all rows before processing
    - Maximum file size: 5MB
    - Maximum rows: 1000
  - CSV upload processing:
    - Handles partial failures gracefully
    - Skips duplicate active grants
    - Returns detailed results with row numbers and error messages
  - Integration tests: 11 tests passing
    - CSV upload and create grants successfully
    - Invalid CSV format handling
    - Missing columns validation
    - User/system validation
    - Duplicate grant skipping
    - Partial failures
    - File size limits
    - Row count limits
    - Case-insensitive headers
    - Template download
  - Frontend UI: CSV upload fully implemented
    - Toggle between "Grid Editor" and "CSV Upload" modes within bulk upload
    - File input with CSV file selection
    - CSV preview (first 5 rows)
    - Download template button
    - Results display with success/failed/skipped counts
    - Detailed error messages per row
    - Audit log entries for successful grants
  - All acceptance criteria met for both Option A (CSV Upload) and Option B (JSON Bulk Endpoint)

## Notes

**Phase 1 Recommendation:** Start with JSON bulk endpoint (simpler). Can add CSV upload in Phase 2 if needed.

Focus on making it FAST and providing clear feedback. If 1 of 50 grants fails, system owner needs to know which one and why.

Consider providing a CSV template for download.




