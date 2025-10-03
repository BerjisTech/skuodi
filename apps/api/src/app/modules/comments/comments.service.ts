import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommentEntity } from '../../database/entities/comment.entity';
import { ProjectsService } from '../projects/projects.service';
import { UserEntity } from '../../database/entities/user.entity';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(CommentEntity)
    private readonly commentsRepo: Repository<CommentEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    private readonly projectsService: ProjectsService
  ) {}

  async createComment(userId: string, dto: CreateCommentDto) {
    const project = await this.projectsService.findByIdOrFail(dto.projectId, userId);
    const author = await this.usersRepo.findOne({ where: { id: userId } });
    const comment = this.commentsRepo.create({
      project,
      author: author!,
      body: dto.body,
      anchor: dto.anchor,
      category: dto.category ?? 'comment',
    });
    return this.commentsRepo.save(comment);
  }

  async listForProject(projectId: string, userId: string) {
    await this.projectsService.findByIdOrFail(projectId, userId);
    return this.commentsRepo.find({
      where: { project: { id: projectId } },
      relations: ['author'],
      order: { createdAt: 'DESC' },
    });
  }
}
