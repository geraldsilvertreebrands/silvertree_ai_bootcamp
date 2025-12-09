import { BadRequestException } from '@nestjs/common';

export class InvalidManagerException extends BadRequestException {
  constructor(reason: string) {
    super(`Invalid manager assignment: ${reason}`);
  }
}
