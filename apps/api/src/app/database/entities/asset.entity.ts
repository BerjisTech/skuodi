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
import { ProjectAssetEntity } from './project-asset.entity';

export type AssetKind = 'gltf' | 'texture' | 'plan';

@Entity({ name: 'assets' })
export class AssetEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => SpaceEntity, (space) => space.assets, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'space_id' })
  space!: SpaceEntity;

  @ManyToOne(() => UserEntity, (user) => user.assets, {
    eager: true,
  })
  @JoinColumn({ name: 'owner_id' })
  owner!: UserEntity;

  @Column({ type: 'varchar' })
  kind!: AssetKind;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'price_cents', type: 'int', default: 0 })
  priceCents!: number;

  @Column({ type: 'varchar', default: 'personal' })
  license!: string;

  @Column({ name: 'storage_key', type: 'text' })
  storageKey!: string;

  @Column({ name: 'preview_url', type: 'text', nullable: true })
  previewUrl?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => ProjectAssetEntity, (usage) => usage.asset)
  usages?: ProjectAssetEntity[];
}
