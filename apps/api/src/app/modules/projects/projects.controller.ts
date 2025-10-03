import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { toProjectDto } from './dto/project.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post('projects')
  async create(@CurrentUser() user: RequestUser, @Body() body: CreateProjectDto) {
    const project = await this.projectsService.createProject(user.userId, body);
    return toProjectDto(project);
  }

  @Get('projects/:projectId')
  async get(@CurrentUser() user: RequestUser, @Param('projectId') projectId: string) {
    const project = await this.projectsService.findByIdOrFail(projectId, user.userId);
    return toProjectDto(project);
  }

  @Get('spaces/:spaceId/projects')
  async list(
    @CurrentUser() user: RequestUser,
    @Param('spaceId') spaceId: string
  ) {
    const projects = await this.projectsService.listProjects(spaceId, user.userId);
    return projects.map(toProjectDto);
  }
}
