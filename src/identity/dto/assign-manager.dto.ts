import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignManagerDto {
  @IsUUID()
  @IsNotEmpty()
  managerId: string;
}
