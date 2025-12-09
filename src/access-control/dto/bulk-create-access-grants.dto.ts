import { IsArray, ArrayMinSize, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BulkCreateAccessGrantItemDto } from './bulk-create-access-grant-item.dto';

export class BulkCreateAccessGrantsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one grant is required' })
  @ArrayMaxSize(100, { message: 'Maximum 100 grants allowed per request' })
  @ValidateNested({ each: true })
  @Type(() => BulkCreateAccessGrantItemDto)
  grants: BulkCreateAccessGrantItemDto[];
}




