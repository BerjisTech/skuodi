import { AssetEntity } from '../../../database/entities/asset.entity';
import { UserDto } from '../../auth/dto/user.dto';

export interface AssetDto {
  id: string;
  spaceId: string;
  owner: UserDto;
  kind: string;
  title: string;
  description?: string | null;
  priceCents: number;
  license: string;
  storageKey: string;
  previewUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toAssetDto(entity: AssetEntity): AssetDto {
  return {
    id: entity.id,
    spaceId: entity.space.id,
    owner: UserDto.fromEntity(entity.owner),
    kind: entity.kind,
    title: entity.title,
    description: entity.description ?? null,
    priceCents: entity.priceCents,
    license: entity.license,
    storageKey: entity.storageKey,
    previewUrl: entity.previewUrl ?? null,
    metadata: entity.metadata ?? null,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
