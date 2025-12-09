import { NotFoundException } from '@nestjs/common';

export class AccessTierNotFoundException extends NotFoundException {
  constructor(tierId: string) {
    super(`Access tier with ID ${tierId} not found`);
  }
}
