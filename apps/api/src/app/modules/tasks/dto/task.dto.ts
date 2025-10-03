import { TaskEntity } from '../../../database/entities/task.entity';
import { UserDto } from '../../auth/dto/user.dto';

export interface TaskDto {
  id: string;
  projectId: string;
  author: UserDto;
  assignee?: UserDto | null;
  title: string;
  description?: string | null;
  status: string;
  dueAt?: Date | null;
  anchor?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toTaskDto(entity: TaskEntity): TaskDto {
  return {
    id: entity.id,
    projectId: entity.project.id,
    author: UserDto.fromEntity(entity.author),
    assignee: entity.assignee ? UserDto.fromEntity(entity.assignee) : null,
    title: entity.title,
    description: entity.description ?? null,
    status: entity.status,
    dueAt: entity.dueAt ?? null,
    anchor: entity.anchor ?? null,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
