import { AccessRequestStatus, AccessRequestItemStatus } from '../entities/access-request.entity';
import { AccessGrantStatus } from '../entities/access-grant.entity';
import { BadRequestException } from '@nestjs/common';

/**
 * Valid status transitions for AccessRequest
 */
const VALID_REQUEST_TRANSITIONS: Record<AccessRequestStatus, AccessRequestStatus[]> = {
  [AccessRequestStatus.REQUESTED]: [
    AccessRequestStatus.APPROVED,
    AccessRequestStatus.REJECTED,
  ],
  [AccessRequestStatus.APPROVED]: [], // Terminal state (after approval, system owners provision)
  [AccessRequestStatus.REJECTED]: [], // Terminal state
};

/**
 * Valid status transitions for AccessRequestItem
 */
const VALID_ITEM_TRANSITIONS: Record<AccessRequestItemStatus, AccessRequestItemStatus[]> = {
  [AccessRequestItemStatus.REQUESTED]: [
    AccessRequestItemStatus.APPROVED,
    AccessRequestItemStatus.REJECTED,
  ],
  [AccessRequestItemStatus.APPROVED]: [], // Terminal state
  [AccessRequestItemStatus.REJECTED]: [], // Terminal state
};

/**
 * Check if a request status transition is valid
 */
export function canTransitionRequest(
  from: AccessRequestStatus,
  to: AccessRequestStatus,
): boolean {
  return VALID_REQUEST_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Check if an item status transition is valid
 */
export function canTransitionItem(
  from: AccessRequestItemStatus,
  to: AccessRequestItemStatus,
): boolean {
  return VALID_ITEM_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Validate request status transition, throw if invalid
 */
export function validateRequestTransition(
  from: AccessRequestStatus,
  to: AccessRequestStatus,
): void {
  if (!canTransitionRequest(from, to)) {
    throw new BadRequestException(
      `Invalid status transition from '${from}' to '${to}'. Valid transitions from '${from}': ${VALID_REQUEST_TRANSITIONS[from]?.join(', ') || 'none'}`,
    );
  }
}

/**
 * Validate item status transition, throw if invalid
 */
export function validateItemTransition(
  from: AccessRequestItemStatus,
  to: AccessRequestItemStatus,
): void {
  if (!canTransitionItem(from, to)) {
    throw new BadRequestException(
      `Invalid status transition from '${from}' to '${to}'. Valid transitions from '${from}': ${VALID_ITEM_TRANSITIONS[from]?.join(', ') || 'none'}`,
    );
  }
}

/**
 * Valid status transitions for AccessGrant
 */
const VALID_GRANT_TRANSITIONS: Record<AccessGrantStatus, AccessGrantStatus[]> = {
  [AccessGrantStatus.ACTIVE]: [
    AccessGrantStatus.TO_REMOVE,
    AccessGrantStatus.REMOVED, // Can directly remove if needed
  ],
  [AccessGrantStatus.TO_REMOVE]: [
    AccessGrantStatus.REMOVED,
    AccessGrantStatus.ACTIVE, // Can cancel removal
  ],
  [AccessGrantStatus.REMOVED]: [], // Terminal state
};

/**
 * Check if a grant status transition is valid
 */
export function canTransitionGrant(
  from: AccessGrantStatus,
  to: AccessGrantStatus,
): boolean {
  return VALID_GRANT_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Validate grant status transition, throw if invalid
 */
export function validateGrantTransition(
  from: AccessGrantStatus,
  to: AccessGrantStatus,
): void {
  if (!canTransitionGrant(from, to)) {
    throw new BadRequestException(
      `Invalid status transition from '${from}' to '${to}'. Valid transitions from '${from}': ${VALID_GRANT_TRANSITIONS[from]?.join(', ') || 'none'}`,
    );
  }
}

