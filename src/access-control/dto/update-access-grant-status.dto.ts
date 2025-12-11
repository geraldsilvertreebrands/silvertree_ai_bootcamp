import { IsEnum } from 'class-validator';
import { AccessGrantStatus } from '../entities/access-grant.entity';

export class UpdateAccessGrantStatusDto {
  @IsEnum(AccessGrantStatus)
  status: AccessGrantStatus;
}






