import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ProjectEntity } from '../../database/entities/project.entity';
import { SpaceMemberEntity } from '../../database/entities/space-member.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { DocEntity } from '../../database/entities/doc.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectEntity,
      SpaceMemberEntity,
      UserEntity,
      DocEntity,
    ]),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
