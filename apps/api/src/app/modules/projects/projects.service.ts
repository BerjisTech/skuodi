import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity } from '../../database/entities/project.entity';
import { SpaceMemberEntity } from '../../database/entities/space-member.entity';
import { DocEntity } from '../../database/entities/doc.entity';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectsRepo: Repository<ProjectEntity>,
    @InjectRepository(SpaceMemberEntity)
    private readonly membersRepo: Repository<SpaceMemberEntity>,
    @InjectRepository(DocEntity)
    private readonly docsRepo: Repository<DocEntity>
  ) {}

  async createProject(userId: string, dto: CreateProjectDto): Promise<ProjectEntity> {
    const member = await this.membersRepo.findOne({
      where: { space: { id: dto.spaceId }, user: { id: userId } },
      relations: ['space', 'space.owner', 'user'],
    });
    if (!member) {
      throw new ForbiddenException('Not a member of the space');
    }

    const creator = member.user;
    const space = member.space;

    const project = this.projectsRepo.create({
      name: dto.name,
      space,
      createdBy: creator,
    });
    const saved = await this.projectsRepo.save(project);

    await this.seedDocs(saved);

    return this.findByIdOrFail(saved.id, userId);
  }

  async listProjects(spaceId: string, userId: string): Promise<ProjectEntity[]> {
    await this.ensureMembership(spaceId, userId);
    return this.projectsRepo.find({
      where: { space: { id: spaceId } },
      relations: ['space', 'space.owner', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByIdOrFail(projectId: string, userId: string): Promise<ProjectEntity> {
    const project = await this.projectsRepo.findOne({
      where: { id: projectId },
      relations: ['space', 'space.owner', 'createdBy'],
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    await this.ensureMembership(project.space.id, userId);
    return project;
  }

  private async ensureMembership(spaceId: string, userId: string) {
    const member = await this.membersRepo.findOne({
      where: { space: { id: spaceId }, user: { id: userId } },
    });
    if (!member) {
      throw new ForbiddenException('Not a member');
    }
  }

  private async seedDocs(project: ProjectEntity) {
    const emptyDoc = Buffer.from(new Uint8Array());
    const docs: Partial<DocEntity>[] = [
      { project, kind: 'plan2d', ydoc: emptyDoc },
      { project, kind: 'scene3d', ydoc: emptyDoc },
      { project, kind: 'notes', ydoc: emptyDoc },
    ];
    for (const doc of docs) {
      const entity = this.docsRepo.create(doc);
      await this.docsRepo.save(entity);
    }
  }
}
