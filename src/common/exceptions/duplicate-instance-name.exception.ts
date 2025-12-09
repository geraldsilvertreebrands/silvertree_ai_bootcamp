import { ConflictException } from '@nestjs/common';

export class DuplicateInstanceNameException extends ConflictException {
  constructor(name: string, systemId: string) {
    super(`System instance with name "${name}" already exists for system ${systemId}`);
  }
}
