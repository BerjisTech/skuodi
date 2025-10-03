import { Module } from '@nestjs/common';
import { IoController } from './io.controller';
import { IoService } from './io.service';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [ProjectsModule],
  controllers: [IoController],
  providers: [IoService],
})
export class IoModule {}
