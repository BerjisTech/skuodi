import { IsBase64, IsOptional, IsString } from 'class-validator';

export class UpdateDocDto {
  @IsBase64()
  ydoc!: string;

  @IsOptional()
  @IsString()
  metadata?: string;
}
