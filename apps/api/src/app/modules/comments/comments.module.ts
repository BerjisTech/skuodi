import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { CommentEntity } from '../../database/entities/comment.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [TypeOrmModule.forFeature([CommentEntity, UserEntity]), ProjectsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
