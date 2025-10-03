import { Module } from '@nestjs/common';
import { RtcController } from './rtc.controller';
import { RtcService } from './rtc.service';
import { SpacesModule } from '../spaces/spaces.module';

@Module({
  imports: [SpacesModule],
  controllers: [RtcController],
  providers: [RtcService],
})
export class RtcModule {}
