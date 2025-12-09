import { ConflictException } from '@nestjs/common';

export class DuplicateEmailException extends ConflictException {
  constructor(email: string) {
    super(`User with email ${email} already exists`);
  }
}
