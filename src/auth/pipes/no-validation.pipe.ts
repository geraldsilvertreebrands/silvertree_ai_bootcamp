import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class NoValidationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    // Just return the value as-is, no validation
    return value;
  }
}






