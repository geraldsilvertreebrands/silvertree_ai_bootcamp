import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';

@Injectable()
export class ConditionalValidationPipe implements PipeTransform {
  private validationPipe: ValidationPipe;

  constructor() {
    this.validationPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      skipMissingProperties: true,
      skipNullProperties: true,
      skipUndefinedProperties: true,
    });
  }

  transform(value: any, metadata: ArgumentMetadata) {
    // Skip validation for auth/login endpoint
    if (metadata.type === 'body' && metadata.data === undefined) {
      // Check if this is the login route by checking if value has email but no password validation needed
      if (value && value.email && typeof value.email === 'string') {
        // Just return the value as-is for login
        return value;
      }
    }
    
    // For other routes, use normal validation
    return this.validationPipe.transform(value, metadata);
  }
}






