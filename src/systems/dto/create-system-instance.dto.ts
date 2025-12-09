import { IsNotEmpty, IsString, IsUUID, MaxLength, IsOptional } from 'class-validator';

export class CreateSystemInstanceDto {
  @IsNotEmpty()
  @IsUUID()
  systemId: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  environment?: string;
}
