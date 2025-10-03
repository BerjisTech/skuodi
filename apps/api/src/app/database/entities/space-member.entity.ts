import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { SpaceEntity } from './space.entity';
import { UserEntity } from './user.entity';

export type SpaceRole = 'user' | 'architect' | 'org_owner' | 'admin';

@Entity({ name: 'space_members' })
@Unique(['space', 'user'])
export class SpaceMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => SpaceEntity, (space) => space.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'space_id' })
  space!: SpaceEntity;

  @ManyToOne(() => UserEntity, (user) => user.memberships, {
    onDelete: 'CASCADE',
    eager: true,
  })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ default: 'user' })
  role!: SpaceRole;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
