import { IsUUID, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { AccessGrantStatus } from '../entities/access-grant.entity';

export class CreateAccessGrantDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  systemInstanceId: string;

  @IsUUID()
  accessTierId: string;

  @IsOptional()
  @IsUUID()
  grantedById?: string;

  @IsOptional()
  @IsDateString()
  grantedAt?: string;

  @IsOptional()
  @IsEnum(AccessGrantStatus)
  status?: AccessGrantStatus;
}







