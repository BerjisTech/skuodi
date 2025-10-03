import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DocEntity } from './doc.entity';

@Entity({ name: 'doc_snapshots' })
export class DocSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => DocEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'doc_id' })
  doc!: DocEntity;

  @Column({ type: 'bytea' })
  ydoc!: Buffer;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
