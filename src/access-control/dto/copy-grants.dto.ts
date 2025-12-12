import { IsUUID, IsOptional, IsArray, IsString } from 'class-validator';

export class CopyGrantsDto {
  @IsUUID()
  sourceUserId: string;

  @IsUUID()
  targetUserId: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  systemIds?: string[]; // Only copy from these systems

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  excludeSystemIds?: string[]; // Exclude these systems
}

export interface CopyGrantsResult {
  created: Array<{
    id: string;
    status: string;
    targetUserId: string;
    items: Array<{
      id: string;
      systemInstanceId: string;
      accessTierId: string;
      status: string;
    }>;
  }>;
  skipped: Array<{
    systemInstanceId: string;
    accessTierId: string;
    reason: string;
  }>;
  summary: {
    total: number;
    created: number;
    skipped: number;
    autoApproved: number;
  };
}




