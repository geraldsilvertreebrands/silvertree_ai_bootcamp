import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { AccessGrantStatus } from '../entities/access-grant.entity';

/**
 * DTO for individual grants in bulk operations.
 * Uses @IsString() instead of @IsUUID() to allow invalid UUIDs through validation
 * so the service can return detailed error messages.
 */
export class BulkCreateAccessGrantItemDto {
  @IsString()
  userId: string;

  @IsString()
  systemInstanceId: string;

  @IsString()
  accessTierId: string;

  @IsOptional()
  @IsString()
  grantedById?: string;

  @IsOptional()
  @IsDateString()
  grantedAt?: string;

  @IsOptional()
  @IsEnum(AccessGrantStatus)
  status?: AccessGrantStatus;
}

