import { IsBase64, IsOptional, IsString } from 'class-validator';

export class CreateSnapshotDto {
  @IsBase64()
  ydoc!: string;

  @IsOptional()
  @IsString()
  label?: string;
}
