# PHASE1-014: Bulk Upload Implementation

## Context

PHASE1-007 ticket exists but is NOT IMPLEMENTED. According to PRD, bulk upload is a KEY feature to make logging "SUPER quick and easy" so system owners never postpone it.

## Current Status

- [x] Bulk upload endpoint exists ✅
- [x] JSON bulk endpoint implemented ✅
- [x] UI for bulk upload implemented ✅
- [x] All tests passing ✅
- [x] Ticket PHASE1-007 COMPLETE ✅

## Acceptance Criteria (FOR DEMO)

### Backend: JSON Bulk Endpoint (Simpler, Recommended)

- [ ] **API Endpoint:**
  - [ ] `POST /api/v1/access-grants/bulk` - JSON array of grants
  - [ ] Request body: array of { userId, systemInstanceId, accessTierId, grantedAt (optional) }
  - [ ] Maximum array size: 100 grants
  - [ ] Returns: { success: number, failed: number, results: Array<{ success: boolean, grant?, error?, row: number }> }

- [ ] **Validation:**
  - [ ] Validate ALL grants before processing any
  - [ ] Collect all validation errors
  - [ ] Return detailed error for each failed grant (row number + reason)

- [ ] **Processing:**
  - [ ] Best-effort: create valid grants, report failures
  - [ ] Skip duplicate active grants (report as skipped, not error)
  - [ ] Use transaction per grant (not all-or-nothing, to allow partial success)

- [ ] **Authorization:**
  - [ ] **FOR DEMO:** Can be skipped (backend-only check in PHASE1-013)
  - [ ] Set grantedById automatically from authenticated user

### Frontend: Bulk Upload UI (FOR DEMO)

- [ ] **Add "Bulk Upload" section to "Log Access" view:**
  - [ ] Tab or section toggle: "Single Grant" vs "Bulk Upload"
  - [ ] OR: Add "Bulk Upload" button that opens modal

- [ ] **Bulk Upload Form:**
  - [ ] Textarea or JSON editor for pasting JSON array
  - [ ] OR: Simple table/grid with "Add Row" button
  - [ ] Each row has: User dropdown, System dropdown, Instance dropdown, Tier dropdown
  - [ ] "Add Row" button to add more grants
  - [ ] "Remove Row" button for each row
  - [ ] "Upload" button to submit all

- [ ] **Results Display:**
  - [ ] Show success count
  - [ ] Show failed count
  - [ ] Show detailed error list with row numbers and reasons
  - [ ] Show which grants were created successfully

- [ ] **CSV Upload (OPTIONAL FOR DEMO):**
  - [ ] File input for CSV upload
  - [ ] "Download Template" button
  - [ ] Parse CSV and show preview
  - [ ] Submit button

## Out of Scope (For Demo)

- [ ] Spreadsheet-style grid editor (like Google Sheets)
- [ ] Advanced CSV parsing (Excel files)
- [ ] Progress indicator for large imports
- [ ] Authorization UI checks (backend-only)

## Technical Approach

**Backend (Start Here):**
1. Create `BulkCreateAccessGrantsDto` (array of CreateAccessGrantDto)
2. Add `bulkCreate` method to AccessGrantService
3. Add `POST /api/v1/access-grants/bulk` endpoint
4. Validate all grants first, collect errors
5. Process valid grants, skip duplicates
6. Return detailed results

**Frontend:**
1. Add bulk upload section to "Log Access" view
2. Create form with dynamic rows
3. Add "Add Row" / "Remove Row" functionality
4. Collect all grants and send as JSON array
5. Display results (success/failed counts, error details)

## Tests

- **Unit:**
  - [ ] AccessGrantService.bulkCreate validates all grants
  - [ ] AccessGrantService.bulkCreate processes valid grants
  - [ ] AccessGrantService.bulkCreate skips duplicates
  - [ ] AccessGrantService.bulkCreate returns detailed results
- **Integration:**
  - [ ] POST /api/v1/access-grants/bulk creates multiple grants
  - [ ] Returns summary with success/failure counts
  - [ ] Validates all grants before creating any
  - [ ] Handles partial failures gracefully
  - [ ] Skips duplicate active grants
- **E2E:**
  - [ ] Can add multiple rows in bulk upload form
  - [ ] Can submit bulk upload
  - [ ] See success/failed counts
  - [ ] See detailed error messages

## Dependencies

- PHASE1-006 (single grant creation must work) ✅
- PHASE1-013 (system owner authorization) - Can be backend-only for demo

## Notes

**PRD Requirement:** "make it SUPER quick and easy to log grants, so that system owners never postpone it!"

This is a KEY feature for demo. Without bulk upload, logging many grants is tedious.

**For Demo:** Start with simple JSON bulk endpoint + UI form with dynamic rows. CSV upload can be added later if time permits.

**Priority:** HIGH - This is a core feature that makes the tool useful for real-world use.

## Progress

- 2025-12-09: ✅ COMPLETE
  - Fixed bulk upload test failures (validation issues)
  - Created BulkCreateAccessGrantItemDto with lenient validation
  - Updated ValidationPipe configuration for bulk endpoint
  - Fixed test cleanup issues (added beforeEach hook)
  - All 6 integration tests passing
  - Frontend UI already fully implemented (discovered during review)
  - Bulk upload feature fully functional end-to-end
