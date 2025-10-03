import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProjectEntity } from './project.entity';
import { UserEntity } from './user.entity';
import { CommentAnchor } from './comment.entity';

export type TaskStatus = 'todo' | 'in-progress' | 'done';

@Entity({ name: 'tasks' })
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ProjectEntity, (project) => project.tasks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project!: ProjectEntity;

  @ManyToOne(() => UserEntity, (user) => user.comments, {
    eager: true,
  })
  @JoinColumn({ name: 'author_id' })
  author!: UserEntity;

  @ManyToOne(() => UserEntity, (user) => user.assignedTasks, {
    eager: true,
    nullable: true,
  })
  @JoinColumn({ name: 'assignee_id' })
  assignee?: UserEntity | null;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', default: 'todo' })
  status!: TaskStatus;

  @Column({ type: 'jsonb', nullable: true })
  anchor?: CommentAnchor | null;

  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
