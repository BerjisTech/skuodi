import { Injectable } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class IoService {
  constructor(private readonly projectsService: ProjectsService) {}

  async ensureProjectAccess(projectId: string, userId: string) {
    return this.projectsService.findByIdOrFail(projectId, userId);
  }
}
