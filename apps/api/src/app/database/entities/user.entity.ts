import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SpaceEntity } from './space.entity';
import { SpaceMemberEntity } from './space-member.entity';
import { ProjectEntity } from './project.entity';
import { AssetEntity } from './asset.entity';
import { CommentEntity } from './comment.entity';
import { TaskEntity } from './task.entity';
import { SpaceInviteEntity } from './space-invite.entity';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ name: 'display_name' })
  displayName!: string;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => SpaceEntity, (space) => space.owner)
  ownedSpaces?: SpaceEntity[];

  @OneToMany(() => SpaceMemberEntity, (member) => member.user)
  memberships?: SpaceMemberEntity[];

  @OneToMany(() => ProjectEntity, (project) => project.createdBy)
  projects?: ProjectEntity[];

  @OneToMany(() => AssetEntity, (asset) => asset.owner)
  assets?: AssetEntity[];

  @OneToMany(() => CommentEntity, (comment) => comment.author)
  comments?: CommentEntity[];

  @OneToMany(() => TaskEntity, (task) => task.assignee)
  assignedTasks?: TaskEntity[];

  @OneToMany(() => SpaceInviteEntity, (invite) => invite.createdBy)
  sentInvites?: SpaceInviteEntity[];
}
