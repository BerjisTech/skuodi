import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { APP_ENV_TOKEN, EnvVars } from '../config';
import { AssetEntity } from './entities/asset.entity';
import { CommentEntity } from './entities/comment.entity';
import { DocEntity } from './entities/doc.entity';
import { DocSnapshotEntity } from './entities/doc-snapshot.entity';
import { ProjectEntity } from './entities/project.entity';
import { ProjectAssetEntity } from './entities/project-asset.entity';
import { SpaceEntity } from './entities/space.entity';
import { SpaceInviteEntity } from './entities/space-invite.entity';
import { SpaceMemberEntity } from './entities/space-member.entity';
import { TaskEntity } from './entities/task.entity';
import { UserEntity } from './entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [APP_ENV_TOKEN],
      useFactory: (env: EnvVars) => {
        return {
          type: 'postgres',
          url: env.DATABASE_URL,
          autoLoadEntities: false,
          entities: [
            AssetEntity,
            CommentEntity,
            DocEntity,
            DocSnapshotEntity,
            ProjectAssetEntity,
            ProjectEntity,
            SpaceEntity,
            SpaceInviteEntity,
            SpaceMemberEntity,
            TaskEntity,
            UserEntity,
          ],
          namingStrategy: new SnakeNamingStrategy(),
          synchronize: false,
        } as const;
      },
    }),
  ],
})
export class DatabaseModule {}
