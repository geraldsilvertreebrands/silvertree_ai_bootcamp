# PHASE2-007: Copy Grants from User

## Context

When onboarding new team members, managers often want to give them the same access as an existing team member. This "copy from user" feature streamlines onboarding by creating access requests for all active grants of a reference user.

## Acceptance Criteria

- [ ] **Copy Grants Endpoint:**
  - [ ] `POST /api/v1/access-requests/copy-from-user` - Copy grants from one user to another
  - [ ] Request body: `sourceUserId`, `targetUserId`, `systemIds` (optional filter)
  - [ ] Creates access requests for all active grants of source user
  - [ ] Applies auto-approval logic (if requester is target's manager)
  - [ ] Returns list of created requests with their statuses

- [ ] **Filtering Options:**
  - [ ] Optional `systemIds` array to copy only specific systems
  - [ ] Optional `excludeSystemIds` array to exclude specific systems
  - [ ] Skip grants where target user already has active/pending access

- [ ] **Validation:**
  - [ ] Source user must exist
  - [ ] Target user must exist
  - [ ] Source user must have at least one active grant
  - [ ] Requester must be manager of target user OR admin

- [ ] **Response:**
  - [ ] Return array of created requests
  - [ ] Include status for each (requested/approved based on auto-approval)
  - [ ] Include skipped grants with reason (already has access, etc.)

## Technical Approach

### 1. DTO
```typescript
// src/access-control/dto/copy-grants.dto.ts
export class CopyGrantsDto {
  @IsUUID()
  sourceUserId: string;

  @IsUUID()
  targetUserId: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  systemIds?: string[];  // Only copy from these systems

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  excludeSystemIds?: string[];  // Exclude these systems
}

export class CopyGrantsResultDto {
  created: AccessGrant[];
  skipped: {
    systemInstanceId: string;
    accessTierId: string;
    reason: string;
  }[];
  summary: {
    total: number;
    created: number;
    skipped: number;
    autoApproved: number;
  };
}
```

### 2. Service Method
```typescript
// src/access-control/services/access-grant.service.ts
async copyGrantsFromUser(
  dto: CopyGrantsDto,
  requesterId: string,
): Promise<CopyGrantsResultDto> {
  // 1. Validate users exist
  const sourceUser = await this.userRepository.findOneOrFail({
    where: { id: dto.sourceUserId },
  });
  const targetUser = await this.userRepository.findOneOrFail({
    where: { id: dto.targetUserId },
    relations: ['manager'],
  });

  // 2. Get source user's active grants
  let query = this.repository
    .createQueryBuilder('grant')
    .innerJoinAndSelect('grant.systemInstance', 'instance')
    .innerJoinAndSelect('instance.system', 'system')
    .innerJoinAndSelect('grant.accessTier', 'tier')
    .where('grant.userId = :sourceUserId', { sourceUserId: dto.sourceUserId })
    .andWhere('grant.status = :status', { status: AccessGrantStatus.ACTIVE });

  // Apply filters
  if (dto.systemIds?.length) {
    query = query.andWhere('system.id IN (:...systemIds)', {
      systemIds: dto.systemIds
    });
  }
  if (dto.excludeSystemIds?.length) {
    query = query.andWhere('system.id NOT IN (:...excludeIds)', {
      excludeIds: dto.excludeSystemIds
    });
  }

  const sourceGrants = await query.getMany();

  // 3. Get target user's existing grants (to avoid duplicates)
  const existingGrants = await this.repository.find({
    where: {
      userId: dto.targetUserId,
      status: In([
        AccessGrantStatus.REQUESTED,
        AccessGrantStatus.APPROVED,
        AccessGrantStatus.ACTIVE,
      ]),
    },
  });
  const existingKeys = new Set(
    existingGrants.map(g => `${g.systemInstanceId}-${g.accessTierId}`)
  );

  // 4. Create requests for each source grant
  const created: AccessGrant[] = [];
  const skipped: CopyGrantsResultDto['skipped'] = [];
  const isManagerRequest = targetUser.managerId === requesterId;

  for (const sourceGrant of sourceGrants) {
    const key = `${sourceGrant.systemInstanceId}-${sourceGrant.accessTierId}`;

    if (existingKeys.has(key)) {
      skipped.push({
        systemInstanceId: sourceGrant.systemInstanceId,
        accessTierId: sourceGrant.accessTierId,
        reason: 'Target user already has this access',
      });
      continue;
    }

    const newGrant = await this.createRequest(
      {
        userId: dto.targetUserId,
        systemInstanceId: sourceGrant.systemInstanceId,
        accessTierId: sourceGrant.accessTierId,
        justification: `Copied from ${sourceUser.name}`,
      },
      requesterId,
    );
    created.push(newGrant);
  }

  return {
    created,
    skipped,
    summary: {
      total: sourceGrants.length,
      created: created.length,
      skipped: skipped.length,
      autoApproved: created.filter(
        g => g.status === AccessGrantStatus.APPROVED
      ).length,
    },
  };
}
```

### 3. Controller Endpoint
```typescript
// src/access-control/controllers/access-requests.controller.ts
@Post('copy-from-user')
async copyFromUser(
  @Body() dto: CopyGrantsDto,
  @CurrentUser() user: User,
): Promise<CopyGrantsResultDto> {
  return this.accessGrantService.copyGrantsFromUser(dto, user.id);
}
```

## Agents to Use

| Step | Agent | Purpose |
|------|-------|---------|
| 1 | `/research` | Understand existing grant queries |
| 2 | `/testing` | Write tests for copy functionality |
| 3 | `/backend` | Create DTO and service method |
| 4 | `/backend` | Create controller endpoint |
| 5 | `/testing` | Verify all tests pass |

## Tests

- **Integration:**
  - [ ] Copy all active grants from source to target
  - [ ] Copied grants have correct status (requested or auto-approved)
  - [ ] Skips grants where target already has access
  - [ ] Filter by systemIds works correctly
  - [ ] Filter by excludeSystemIds works correctly
  - [ ] Returns 404 if source user not found
  - [ ] Returns 404 if target user not found
  - [ ] Returns empty result if source has no active grants
  - [ ] Summary counts are accurate
  - [ ] Auto-approval works when requester is target's manager
  - [ ] Creates in requested status when requester is not manager

## Dependencies

- PHASE2-002 (Access request creation must work)
- PHASE2-003 (Auto-approval logic must work)

## Progress

- YYYY-MM-DD: Ticket created

## Notes

- This is a convenience feature for onboarding
- Consider UI to show "Copy from team member" button
- Manager should be able to select which systems to copy
- Useful for "same role" onboarding scenarios
