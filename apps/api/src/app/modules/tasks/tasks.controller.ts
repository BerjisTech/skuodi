import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { toTaskDto } from './dto/task.dto';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  async create(@CurrentUser() user: RequestUser, @Body() body: CreateTaskDto) {
    const task = await this.tasksService.createTask(user.userId, body);
    return toTaskDto(task);
  }

  @Patch(':taskId')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('taskId') taskId: string,
    @Body() body: UpdateTaskDto
  ) {
    const task = await this.tasksService.updateTask(taskId, user.userId, body);
    return toTaskDto(task);
  }

  @Get()
  async list(@CurrentUser() user: RequestUser, @Query('projectId') projectId: string) {
    const tasks = await this.tasksService.listTasks(projectId, user.userId);
    return tasks.map(toTaskDto);
  }
}
