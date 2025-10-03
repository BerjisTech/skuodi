import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class RequestUploadDto {
  @IsNotEmpty()
  filename!: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsUUID()
  spaceId!: string;
}
