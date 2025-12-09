import { ConflictException } from '@nestjs/common';

export class DuplicateSystemNameException extends ConflictException {
  constructor(name: string) {
    super(`System with name "${name}" already exists`);
  }
}
