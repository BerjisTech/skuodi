import { CommentEntity } from '../../../database/entities/comment.entity';
import { UserDto } from '../../auth/dto/user.dto';

export interface CommentDto {
  id: string;
  projectId: string;
  author: UserDto;
  body: string;
  anchor?: Record<string, unknown> | null;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toCommentDto(entity: CommentEntity): CommentDto {
  return {
    id: entity.id,
    projectId: entity.project.id,
    author: UserDto.fromEntity(entity.author),
    body: entity.body,
    anchor: entity.anchor ?? null,
    category: entity.category,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
