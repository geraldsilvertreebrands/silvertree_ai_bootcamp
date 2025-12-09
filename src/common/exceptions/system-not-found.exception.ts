import { NotFoundException } from '@nestjs/common';

export class SystemNotFoundException extends NotFoundException {
  constructor(systemId: string) {
    super(`System with ID ${systemId} not found`);
  }
}
