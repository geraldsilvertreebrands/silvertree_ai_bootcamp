import { ArrayMinSize, IsArray, IsOptional, IsUUID, IsString } from 'class-validator';

export class CreateAccessRequestItemDto {
  @IsUUID()
  systemInstanceId: string;

  @IsUUID()
  accessTierId: string;
}

export class CreateAccessRequestDto {
  @IsUUID()
  targetUserId: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  items: CreateAccessRequestItemDto[];
}




