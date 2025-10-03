import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { toCommentDto } from './dto/comment.dto';

@Controller('comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  async create(@CurrentUser() user: RequestUser, @Body() body: CreateCommentDto) {
    const comment = await this.commentsService.createComment(user.userId, body);
    return toCommentDto(comment);
  }

  @Get()
  async list(
    @CurrentUser() user: RequestUser,
    @Query('projectId') projectId: string
  ) {
    const comments = await this.commentsService.listForProject(projectId, user.userId);
    return comments.map(toCommentDto);
  }
}
