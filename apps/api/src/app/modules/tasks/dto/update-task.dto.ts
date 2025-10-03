import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { TaskStatus } from '../../../database/entities/task.entity';

const STATUSES: TaskStatus[] = ['todo', 'in-progress', 'done'];

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: TaskStatus;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  dueAt?: string;

  @IsOptional()
  anchor?: {
    type: '2d' | '3d';
    selection: Record<string, unknown>;
    screenshot?: string;
  };
}
