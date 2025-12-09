import { IsNotEmpty, IsString, MaxLength, IsOptional } from 'class-validator';

export class CreateSystemDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
