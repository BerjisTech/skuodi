import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SpaceEntity } from './space.entity';
import { UserEntity } from './user.entity';
import { SpaceRole } from './space-member.entity';

@Entity({ name: 'space_invites' })
export class SpaceInviteEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => SpaceEntity, (space) => space.invites, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'space_id' })
  space!: SpaceEntity;

  @ManyToOne(() => UserEntity, (user) => user.sentInvites, {
    eager: true,
  })
  @JoinColumn({ name: 'created_by' })
  createdBy!: UserEntity;

  @Column({ type: 'text' })
  email!: string;

  @Column({ type: 'varchar', default: 'user' })
  role!: SpaceRole;

  @Column({ type: 'varchar', unique: true })
  token!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
