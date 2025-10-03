import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { AssetsService } from './assets.service';
import { RequestUploadDto } from './dto/request-upload.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { toAssetDto } from './dto/asset.dto';

@Controller('assets')
@UseGuards(JwtAuthGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post('upload-url')
  async requestUpload(
    @CurrentUser() user: RequestUser,
    @Body() body: RequestUploadDto
  ) {
    return this.assetsService.requestUpload(user.userId, body);
  }

  @Post()
  async create(@CurrentUser() user: RequestUser, @Body() body: CreateAssetDto) {
    const asset = await this.assetsService.createAsset(user.userId, body);
    return toAssetDto(asset);
  }

  @Get()
  async list(@Query('spaceId') spaceId?: string) {
    const assets = await this.assetsService.listAssets(spaceId);
    return assets.map(toAssetDto);
  }

  @Get(':assetId')
  async get(@CurrentUser() user: RequestUser, @Param('assetId') assetId: string) {
    const asset = await this.assetsService.findByIdForUser(assetId, user.userId);
    return toAssetDto(asset);
  }

  @Get(':assetId/download')
  async download(
    @CurrentUser() user: RequestUser,
    @Param('assetId') assetId: string
  ) {
    return this.assetsService.getDownloadUrl(assetId, user.userId);
  }
}
