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
import { UserEntity } from './user.entity';
import { SpaceMemberEntity } from './space-member.entity';
import { ProjectEntity } from './project.entity';
import { AssetEntity } from './asset.entity';
import { SpaceInviteEntity } from './space-invite.entity';

@Entity({ name: 'spaces' })
export class SpaceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => UserEntity, (user) => user.ownedSpaces, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'owner_id' })
  owner!: UserEntity;

  @Column()
  name!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => SpaceMemberEntity, (member) => member.space)
  members?: SpaceMemberEntity[];

  @OneToMany(() => ProjectEntity, (project) => project.space)
  projects?: ProjectEntity[];

  @OneToMany(() => AssetEntity, (asset) => asset.space)
  assets?: AssetEntity[];

  @OneToMany(() => SpaceInviteEntity, (invite) => invite.space)
  invites?: SpaceInviteEntity[];
}
