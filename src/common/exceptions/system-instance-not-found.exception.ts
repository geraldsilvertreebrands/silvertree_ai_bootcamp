import { NotFoundException } from '@nestjs/common';

export class SystemInstanceNotFoundException extends NotFoundException {
  constructor(instanceId: string) {
    super(`System instance with ID ${instanceId} not found`);
  }
}
