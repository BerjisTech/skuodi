import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SpaceEntity } from './space.entity';
import { UserEntity } from './user.entity';
import { DocEntity } from './doc.entity';
import { CommentEntity } from './comment.entity';
import { TaskEntity } from './task.entity';
import { ProjectAssetEntity } from './project-asset.entity';

@Entity({ name: 'projects' })
export class ProjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => SpaceEntity, (space) => space.projects, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'space_id' })
  space!: SpaceEntity;

  @Column()
  name!: string;

  @ManyToOne(() => UserEntity, (user) => user.projects, {
    eager: true,
  })
  @JoinColumn({ name: 'created_by' })
  createdBy!: UserEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => DocEntity, (doc) => doc.project)
  docs?: DocEntity[];

  @OneToMany(() => CommentEntity, (comment) => comment.project)
  comments?: CommentEntity[];

  @OneToMany(() => TaskEntity, (task) => task.project)
  tasks?: TaskEntity[];

  @OneToMany(() => ProjectAssetEntity, (usage) => usage.project)
  assetUsages?: ProjectAssetEntity[];
}
