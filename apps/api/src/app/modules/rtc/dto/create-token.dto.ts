import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRtcTokenDto {
  @IsUUID()
  spaceId!: string;

  @IsOptional()
  @IsString()
  roomSuffix?: string;
}
