import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { AssetKind } from '../../../database/entities/asset.entity';

const ASSET_KINDS: AssetKind[] = ['gltf', 'texture', 'plan'];

export class CreateAssetDto {
  @IsUUID()
  spaceId!: string;

  @IsEnum(ASSET_KINDS)
  kind!: AssetKind;

  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(0)
  @Max(1_000_000_00)
  priceCents = 0;

  @IsString()
  license = 'personal';

  @IsNotEmpty()
  storageKey!: string;

  @IsOptional()
  @IsString()
  previewUrl?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
