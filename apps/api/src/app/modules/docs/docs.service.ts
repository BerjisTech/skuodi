import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocEntity, DocKind } from '../../database/entities/doc.entity';
import { DocSnapshotEntity } from '../../database/entities/doc-snapshot.entity';
import { ProjectsService } from '../projects/projects.service';
import { UpdateDocDto } from './dto/update-doc.dto';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';

@Injectable()
export class DocsService {
  constructor(
    @InjectRepository(DocEntity)
    private readonly docsRepo: Repository<DocEntity>,
    @InjectRepository(DocSnapshotEntity)
    private readonly snapshotsRepo: Repository<DocSnapshotEntity>,
    private readonly projectsService: ProjectsService
  ) {}

  async getDoc(projectId: string, kind: DocKind, userId: string) {
    await this.projectsService.findByIdOrFail(projectId, userId);
    const doc = await this.docsRepo.findOne({ where: { project: { id: projectId }, kind } });
    if (!doc) {
      throw new NotFoundException('Doc not found');
    }
    return doc;
  }

  async updateDoc(projectId: string, kind: DocKind, userId: string, payload: UpdateDocDto) {
    const doc = await this.getDoc(projectId, kind, userId);
    doc.ydoc = Buffer.from(payload.ydoc, 'base64');
    doc.metadata = payload.metadata ? JSON.parse(payload.metadata) : doc.metadata;
    await this.docsRepo.save(doc);
    return doc;
  }

  async createSnapshot(
    projectId: string,
    kind: DocKind,
    userId: string,
    payload: CreateSnapshotDto
  ) {
    const doc = await this.getDoc(projectId, kind, userId);
    const snapshot = this.snapshotsRepo.create({
      doc,
      ydoc: Buffer.from(payload.ydoc, 'base64'),
      metadata: payload.label ? { label: payload.label } : undefined,
    });
    return this.snapshotsRepo.save(snapshot);
  }

  async listSnapshots(projectId: string, kind: DocKind, userId: string) {
    const doc = await this.getDoc(projectId, kind, userId);
    return this.snapshotsRepo.find({
      where: { doc: { id: doc.id } },
      order: { createdAt: 'DESC' },
    });
  }
}
