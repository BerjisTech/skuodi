import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpaceEntity } from '../../database/entities/space.entity';
import { SpaceMemberEntity } from '../../database/entities/space-member.entity';
import { SpaceInviteEntity } from '../../database/entities/space-invite.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { SpacesService } from './spaces.service';
import { SpacesController } from './spaces.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SpaceEntity,
      SpaceMemberEntity,
      SpaceInviteEntity,
      UserEntity,
    ]),
  ],
  controllers: [SpacesController],
  providers: [SpacesService],
  exports: [SpacesService],
})
export class SpacesModule {}
