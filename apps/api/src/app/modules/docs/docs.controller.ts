import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { DocsService } from './docs.service';
import { UpdateDocDto } from './dto/update-doc.dto';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { DocKind } from '../../database/entities/doc.entity';

const KINDS: DocKind[] = ['plan2d', 'scene3d', 'notes'];

function ensureKind(kind: string): DocKind {
  if (!KINDS.includes(kind as DocKind)) {
    throw new Error('Invalid doc kind');
  }
  return kind as DocKind;
}

@Controller('projects/:projectId/docs')
@UseGuards(JwtAuthGuard)
export class DocsController {
  constructor(private readonly docsService: DocsService) {}

  @Get(':kind')
  async getDoc(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('kind') kind: string
  ) {
    const doc = await this.docsService.getDoc(projectId, ensureKind(kind), user.userId);
    return {
      id: doc.id,
      projectId,
      kind: doc.kind,
      ydoc: doc.ydoc.toString('base64'),
      metadata: doc.metadata,
      updatedAt: doc.updatedAt,
    };
  }

  @Put(':kind')
  async updateDoc(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('kind') kind: string,
    @Body() body: UpdateDocDto
  ) {
    const doc = await this.docsService.updateDoc(
      projectId,
      ensureKind(kind),
      user.userId,
      body
    );
    return {
      id: doc.id,
      projectId,
      kind: doc.kind,
      ydoc: doc.ydoc.toString('base64'),
      metadata: doc.metadata,
      updatedAt: doc.updatedAt,
    };
  }

  @Post(':kind/snapshots')
  async snapshot(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('kind') kind: string,
    @Body() body: CreateSnapshotDto
  ) {
    const snapshot = await this.docsService.createSnapshot(
      projectId,
      ensureKind(kind),
      user.userId,
      body
    );
    return {
      id: snapshot.id,
      createdAt: snapshot.createdAt,
      metadata: snapshot.metadata,
    };
  }

  @Get(':kind/snapshots')
  async snapshots(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('kind') kind: string
  ) {
    const snapshots = await this.docsService.listSnapshots(
      projectId,
      ensureKind(kind),
      user.userId
    );
    return snapshots.map((snapshot) => ({
      id: snapshot.id,
      createdAt: snapshot.createdAt,
      metadata: snapshot.metadata,
    }));
  }
}
