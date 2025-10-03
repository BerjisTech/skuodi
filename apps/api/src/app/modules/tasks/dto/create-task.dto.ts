import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { TaskStatus } from '../../../database/entities/task.entity';

const STATUSES: TaskStatus[] = ['todo', 'in-progress', 'done'];

export class CreateTaskDto {
  @IsUUID()
  projectId!: string;

  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsIn(STATUSES)
  status: TaskStatus = 'todo';

  @IsOptional()
  dueAt?: string;

  @IsOptional()
  anchor?: {
    type: '2d' | '3d';
    selection: Record<string, unknown>;
    screenshot?: string;
  };
}
