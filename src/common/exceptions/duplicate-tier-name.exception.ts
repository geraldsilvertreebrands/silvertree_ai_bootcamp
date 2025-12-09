import { ConflictException } from '@nestjs/common';

export class DuplicateTierNameException extends ConflictException {
  constructor(name: string, systemId: string) {
    super(`Access tier with name "${name}" already exists for system ${systemId}`);
  }
}
