import { SpaceEntity } from '../../../database/entities/space.entity';
import { SpaceMemberEntity } from '../../../database/entities/space-member.entity';
import { SpaceInviteEntity } from '../../../database/entities/space-invite.entity';
import { UserDto } from '../../auth/dto/user.dto';

export interface SpaceDto {
  id: string;
  name: string;
  owner: UserDto;
  createdAt: Date;
  updatedAt: Date;
}

export interface SpaceMemberDto {
  id: string;
  role: string;
  user: UserDto;
  createdAt: Date;
}

export interface SpaceInviteDto {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export function toSpaceDto(entity: SpaceEntity): SpaceDto {
  return {
    id: entity.id,
    name: entity.name,
    owner: UserDto.fromEntity(entity.owner),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

export function toSpaceMemberDto(entity: SpaceMemberEntity): SpaceMemberDto {
  return {
    id: entity.id,
    role: entity.role,
    user: UserDto.fromEntity(entity.user),
    createdAt: entity.createdAt,
  };
}

export function toSpaceInviteDto(entity: SpaceInviteEntity): SpaceInviteDto {
  return {
    id: entity.id,
    email: entity.email,
    role: entity.role,
    token: entity.token,
    expiresAt: entity.expiresAt,
    createdAt: entity.createdAt,
  };
}
