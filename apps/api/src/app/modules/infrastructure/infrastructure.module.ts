import { Global, Module } from '@nestjs/common';
import { EnvModule } from '../../config';
import { RedisService } from './redis.service';
import { StorageService } from './storage.service';
import { LivekitService } from './livekit.service';

@Global()
@Module({
  imports: [EnvModule],
  providers: [RedisService, StorageService, LivekitService],
  exports: [RedisService, StorageService, LivekitService],
})
export class InfrastructureModule {}
