import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssetEntity } from '../../database/entities/asset.entity';
import { SpaceMemberEntity } from '../../database/entities/space-member.entity';
import { SpaceEntity } from '../../database/entities/space.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { StorageService } from '../infrastructure/storage.service';
import { RequestUploadDto } from './dto/request-upload.dto';
import { CreateAssetDto } from './dto/create-asset.dto';

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(AssetEntity)
    private readonly assetsRepo: Repository<AssetEntity>,
    @InjectRepository(SpaceMemberEntity)
    private readonly membersRepo: Repository<SpaceMemberEntity>,
    @InjectRepository(SpaceEntity)
    private readonly spacesRepo: Repository<SpaceEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    private readonly storageService: StorageService
  ) {}

  async requestUpload(userId: string, dto: RequestUploadDto) {
    await this.ensureMembership(dto.spaceId, userId);
    const sanitizedFilename = dto.filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const storageKey = `spaces/${dto.spaceId}/assets/${userId}/${Date.now()}-${sanitizedFilename}`;
    const uploadUrl = await this.storageService.getUploadUrl(
      storageKey,
      dto.contentType
    );
    return { storageKey, uploadUrl };
  }

  async createAsset(userId: string, dto: CreateAssetDto): Promise<AssetEntity> {
    const membership = await this.ensureMembership(dto.spaceId, userId);
    const owner = await this.usersRepo.findOne({ where: { id: userId } });
    if (!owner) {
      throw new NotFoundException('Owner not found');
    }
    const space = await this.spacesRepo.findOne({ where: { id: dto.spaceId } });
    if (!space) {
      throw new NotFoundException('Space not found');
    }

    const asset = this.assetsRepo.create({
      space,
      owner,
      kind: dto.kind,
      title: dto.title,
      description: dto.description,
      priceCents: dto.priceCents,
      license: dto.license,
      storageKey: dto.storageKey,
      previewUrl: dto.previewUrl,
      metadata: dto.metadata,
    });

    // architects and admins can publish to marketplace
    if (membership.role === 'user' && dto.priceCents > 0) {
      throw new ForbiddenException('Only elevated members can set pricing');
    }

    return this.assetsRepo.save(asset);
  }

  async listAssets(spaceId?: string): Promise<AssetEntity[]> {
    return this.assetsRepo.find({
      where: spaceId ? { space: { id: spaceId } } : {},
      relations: ['owner', 'space'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByIdForUser(assetId: string, userId: string): Promise<AssetEntity> {
    const asset = await this.assetsRepo.findOne({
      where: { id: assetId },
      relations: ['space', 'owner'],
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }
    await this.ensureMembership(asset.space.id, userId);
    return asset;
  }

  async getDownloadUrl(assetId: string, userId: string) {
    const asset = await this.findByIdForUser(assetId, userId);
    const downloadUrl = await this.storageService.getDownloadUrl(asset.storageKey);
    return { downloadUrl };
  }

  private async ensureMembership(spaceId: string, userId: string) {
    const membership = await this.membersRepo.findOne({
      where: { space: { id: spaceId }, user: { id: userId } },
      relations: ['user'],
    });
    if (!membership) {
      throw new ForbiddenException('Not a member of the space');
    }
    return membership;
  }
}
