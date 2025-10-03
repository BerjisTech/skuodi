import { Body, Controller, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { RtcService } from './rtc.service';
import { CreateRtcTokenDto } from './dto/create-token.dto';
import { SpacesService } from '../spaces/spaces.service';

@Controller('rtc')
@UseGuards(JwtAuthGuard)
export class RtcController {
  constructor(
    private readonly rtcService: RtcService,
    private readonly spacesService: SpacesService
  ) {}

  @Post('token')
  async token(@CurrentUser() user: RequestUser, @Body() body: CreateRtcTokenDto) {
    const spaces = await this.spacesService.listSpacesForUser(user.userId);
    const space = spaces.find((item) => item.id === body.spaceId);
    if (!space) {
      throw new NotFoundException('Space not found or inaccessible');
    }
    return this.rtcService.createToken(
      {
        id: user.userId,
        displayName: user.email,
      },
      space,
      body.roomSuffix
    );
  }
}
