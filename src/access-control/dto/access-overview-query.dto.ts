import { IsOptional, IsUUID, IsEnum, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { AccessGrantStatus } from '../entities/access-grant.entity';

export class AccessOverviewQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  systemId?: string;

  @IsOptional()
  @IsUUID()
  systemInstanceId?: string;

  @IsOptional()
  @IsUUID()
  accessTierId?: string;

  @IsOptional()
  @IsEnum(AccessGrantStatus)
  status?: AccessGrantStatus;

  @IsOptional()
  @IsString()
  userSearch?: string; // Search by user name or email

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  sortBy?: 'userName' | 'systemName' | 'grantedAt' = 'grantedAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
