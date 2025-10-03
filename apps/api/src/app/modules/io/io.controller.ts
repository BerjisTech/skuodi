import {
  Body,
  Controller,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Express } from 'express';
import 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { IoService } from './io.service';

const IMPORT_FORMATS = ['dxf', 'svg', 'ifc'] as const;
const EXPORT_FORMATS = ['json', 'svg', 'gltf'] as const;

@Controller()
@UseGuards(JwtAuthGuard)
export class IoController {
  constructor(private readonly ioService: IoService) {}

  @Post('import/:format')
  @UseInterceptors(FileInterceptor('file'))
  async importFile(
    @CurrentUser() user: RequestUser,
    @Param('format') format: string,
    @UploadedFile() file?: Express.Multer.File
  ) {
    if (!IMPORT_FORMATS.includes(format as (typeof IMPORT_FORMATS)[number])) {
      throw new Error('Unsupported format');
    }
    if (!file) {
      throw new Error('File is required');
    }
    return {
      format,
      size: file.size,
      filename: file.originalname,
      entities: [],
      message: `Parsing ${format} is not implemented yet`,
    };
  }

  @Post('export/:projectId/:format')
  async exportProject(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('format') format: string,
    @Body() body: Record<string, unknown>
  ) {
    if (!EXPORT_FORMATS.includes(format as (typeof EXPORT_FORMATS)[number])) {
      throw new Error('Unsupported format');
    }
    const project = await this.ioService.ensureProjectAccess(projectId, user.userId);
    return {
      format,
      projectId,
      options: body,
      content:
        format === 'json'
          ? { projectId: project.id, metadata: project.name }
          : `data:${format};base64,${Buffer.from('todo').toString('base64')}`,
    };
  }
}
