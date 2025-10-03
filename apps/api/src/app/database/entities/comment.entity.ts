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

export type CommentAnchor = {
  type: '2d' | '3d';
  selection: Record<string, unknown>;
  screenshot?: string;
};

@Entity({ name: 'comments' })
export class CommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ProjectEntity, (project) => project.comments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project!: ProjectEntity;

  @ManyToOne(() => UserEntity, (user) => user.comments, {
    eager: true,
  })
  @JoinColumn({ name: 'author_id' })
  author!: UserEntity;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'jsonb', nullable: true })
  anchor?: CommentAnchor | null;

  @Column({ type: 'varchar', default: 'comment' })
  category!: 'comment' | 'issue';

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
