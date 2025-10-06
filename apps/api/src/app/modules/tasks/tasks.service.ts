import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEntity } from '../../database/entities/task.entity';
import { ProjectsService } from '../projects/projects.service';
import { UserEntity } from '../../database/entities/user.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly tasksRepo: Repository<TaskEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    private readonly projectsService: ProjectsService
  ) {}

  async createTask(userId: string, dto: CreateTaskDto) {
    const project = await this.projectsService.findByIdOrFail(dto.projectId, userId);
    const author = await this.usersRepo.findOne({ where: { id: userId } });
    if (!author) {
      throw new NotFoundException('Author not found');
    }

    let assignee: UserEntity | undefined;
    if (dto.assigneeId) {
      assignee = await this.usersRepo.findOne({ where: { id: dto.assigneeId } });
      if (!assignee) {
        throw new NotFoundException('Assignee not found');
      }
    }

    const task = this.tasksRepo.create({
      project,
      author,
      assignee,
      title: dto.title,
      description: dto.description,
      status: dto.status,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      anchor: dto.anchor,
    });

    return this.tasksRepo.save(task);
  }

  async updateTask(taskId: string, userId: string, dto: UpdateTaskDto) {
    const task = await this.tasksRepo.findOne({
      where: { id: taskId },
      relations: ['project', 'project.space'],
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.projectsService.findByIdOrFail(task.project.id, userId);

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.status !== undefined) task.status = dto.status;
    if (dto.dueAt !== undefined) task.dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    if (dto.anchor !== undefined) task.anchor = dto.anchor;

    if (dto.assigneeId !== undefined) {
      if (dto.assigneeId === null) {
        task.assignee = null;
      } else {
        const assignee = await this.usersRepo.findOne({ where: { id: dto.assigneeId } });
        if (!assignee) {
          throw new NotFoundException('Assignee not found');
        }
        task.assignee = assignee;
      }
    }

    return this.tasksRepo.save(task);
  }

  async listTasks(projectId: string, userId: string) {
    await this.projectsService.findByIdOrFail(projectId, userId);
    return this.tasksRepo.find({
      where: { project: { id: projectId } },
      relations: ['author', 'assignee'],
      order: { createdAt: 'ASC' },
    });
  }
}
