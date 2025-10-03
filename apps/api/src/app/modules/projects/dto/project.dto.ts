import { ProjectEntity } from '../../../database/entities/project.entity';
import { UserDto } from '../../auth/dto/user.dto';

export interface ProjectDto {
  id: string;
  name: string;
  spaceId: string;
  createdBy: UserDto;
  createdAt: Date;
  updatedAt: Date;
}

export function toProjectDto(entity: ProjectEntity): ProjectDto {
  return {
    id: entity.id,
    name: entity.name,
    spaceId: entity.space.id,
    createdBy: UserDto.fromEntity(entity.createdBy),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
