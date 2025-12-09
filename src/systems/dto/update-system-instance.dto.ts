import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSystemInstanceDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  environment?: string;
}
