import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocsController } from './docs.controller';
import { DocsService } from './docs.service';
import { DocEntity } from '../../database/entities/doc.entity';
import { DocSnapshotEntity } from '../../database/entities/doc-snapshot.entity';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocEntity, DocSnapshotEntity]),
    ProjectsModule,
  ],
  controllers: [DocsController],
  providers: [DocsService],
})
export class DocsModule {}
