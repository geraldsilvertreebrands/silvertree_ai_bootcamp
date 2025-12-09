import { IsUUID } from 'class-validator';

export class AssignSystemOwnerDto {
  @IsUUID()
  userId: string;
}




