# PHASE2-002: Access Request Creation

## Context

Users need to be able to REQUEST access to systems. This is different from Phase 1 where system owners directly LOG grants. In Phase 2, regular users can request access, which then goes through an approval workflow.

## Acceptance Criteria

- [ ] **New API Endpoint:**
  - [ ] `POST /api/v1/access-requests` - Create access request
  - [ ] Request body: `userId` (grantee), `systemInstanceId`, `accessTierId`, `justification` (optional)
  - [ ] Sets `requestedById` from authenticated user
  - [ ] Sets `requestedAt` to current timestamp
  - [ ] Determines initial status based on requester role (see logic below)

- [ ] **Auto-Approval Logic:**
  - [ ] If requester IS the manager of the grantee → status = `approved`
  - [ ] If requester is NOT the manager → status = `requested`
  - [ ] Auto-approval also sets `approvedById` and `approvedAt`

- [ ] **Validation:**
  - [ ] Grantee user must exist
  - [ ] System instance must exist
  - [ ] Access tier must exist and belong to system
  - [ ] Prevent duplicate pending requests (same user, instance, tier with status `requested` or `approved`)
  - [ ] Allow request if existing grant is `removed` or `rejected`

- [ ] **Response:**
  - [ ] Return created request with all relations
  - [ ] Include status, requestedBy, and approval info if auto-approved

- [ ] **Error Handling:**
  - [ ] 400 for validation errors
  - [ ] 404 if user/instance/tier not found
  - [ ] 409 if duplicate pending request exists

## Technical Approach

### 1. New DTO
```typescript
// src/access-control/dto/create-access-request.dto.ts
export class CreateAccessRequestDto {
  @IsUUID()
  userId: string;  // The grantee (who will receive access)

  @IsUUID()
  systemInstanceId: string;

  @IsUUID()
  accessTierId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  justification?: string;
}
```

### 2. Service Method
```typescript
// src/access-control/services/access-grant.service.ts
async createRequest(
  dto: CreateAccessRequestDto,
  requesterId: string,
): Promise<AccessGrant> {
  // 1. Validate entities exist
  const grantee = await this.userRepository.findOne({
    where: { id: dto.userId },
    relations: ['manager'],
  });
  if (!grantee) throw new UserNotFoundException(dto.userId);

  // 2. Check for duplicate pending request
  const existingPending = await this.repository.findOne({
    where: {
      userId: dto.userId,
      systemInstanceId: dto.systemInstanceId,
      accessTierId: dto.accessTierId,
      status: In([AccessGrantStatus.REQUESTED, AccessGrantStatus.APPROVED]),
    },
  });
  if (existingPending) {
    throw new DuplicatePendingRequestException();
  }

  // 3. Determine status based on requester
  const isManagerRequest = grantee.managerId === requesterId;

  const grant = this.repository.create({
    ...dto,
    requestedById: requesterId,
    requestedAt: new Date(),
    status: isManagerRequest
      ? AccessGrantStatus.APPROVED
      : AccessGrantStatus.REQUESTED,
    // If auto-approved, set approval fields
    ...(isManagerRequest && {
      approvedById: requesterId,
      approvedAt: new Date(),
    }),
  });

  return this.repository.save(grant);
}
```

### 3. Controller Endpoint
```typescript
// src/access-control/controllers/access-requests.controller.ts
@Controller('access-requests')
export class AccessRequestsController {
  @Post()
  async create(
    @Body() dto: CreateAccessRequestDto,
    @CurrentUser() user: User,
  ): Promise<AccessGrant> {
    return this.accessGrantService.createRequest(dto, user.id);
  }
}
```

## Agents to Use

| Step | Agent | Purpose |
|------|-------|---------|
| 1 | `/research` | Understand user-manager relationship |
| 2 | `/testing` | Write tests for request creation and auto-approval |
| 3 | `/backend` | Create DTO and service method |
| 4 | `/backend` | Create controller endpoint |
| 5 | `/testing` | Verify all tests pass |

## Tests

- **Integration:**
  - [ ] POST /api/v1/access-requests creates request in `requested` status
  - [ ] Request from manager auto-approves to `approved` status
  - [ ] Auto-approved request has approvedById and approvedAt set
  - [ ] Returns 409 for duplicate pending request
  - [ ] Allows new request if previous was `rejected`
  - [ ] Allows new request if previous was `removed`
  - [ ] Returns 404 if grantee user not found
  - [ ] Returns 404 if system instance not found
  - [ ] Returns 404 if access tier not found
  - [ ] Validates tier belongs to system
  - [ ] requestedById set from authenticated user
  - [ ] requestedAt set to current time
  - [ ] Response includes all relations

## Dependencies

- PHASE2-001 (Status enum and audit fields must exist)

## Progress

- YYYY-MM-DD: Ticket created

## Notes

- This endpoint is for REQUESTING access, not for system owners logging grants
- System owners can still use `POST /api/v1/access-grants` to directly create `active` grants
- The justification field helps managers make approval decisions
- Consider adding notification trigger here (PHASE2-006) - notify manager when `requested`
