import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { AssetEntity } from '../../database/entities/asset.entity';
import { SpaceMemberEntity } from '../../database/entities/space-member.entity';
import { SpaceEntity } from '../../database/entities/space.entity';
import { UserEntity } from '../../database/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssetEntity,
      SpaceMemberEntity,
      SpaceEntity,
      UserEntity,
    ]),
  ],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
