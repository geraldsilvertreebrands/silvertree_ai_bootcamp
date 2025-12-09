import { UseGuards } from '@nestjs/common';
import { SystemOwnerGuard } from '../guards/system-owner.guard';

/**
 * Decorator to protect routes with system owner authorization.
 * Ensures the current user is a system owner for the system being accessed.
 */
export const SystemOwner = () => UseGuards(SystemOwnerGuard);




