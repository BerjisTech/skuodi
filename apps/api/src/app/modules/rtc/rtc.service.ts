import { ForbiddenException, Injectable } from '@nestjs/common';
import { SpaceEntity } from '../../database/entities/space.entity';
import { LivekitService } from '../infrastructure/livekit.service';
import { SpacesService } from '../spaces/spaces.service';

@Injectable()
export class RtcService {
  constructor(
    private readonly livekit: LivekitService,
    private readonly spacesService: SpacesService
  ) {}

  async createToken(
    user: { id: string; displayName: string },
    space: SpaceEntity,
    roomSuffix?: string
  ) {
    const spaces = await this.spacesService.listSpacesForUser(user.id);
    const hasAccess = spaces.some((spaceEntity) => spaceEntity.id === space.id);
    if (!hasAccess) {
      throw new ForbiddenException('Not a member of the space');
    }
    const room = `space_${space.id}${roomSuffix ? `_${roomSuffix}` : ''}`;
    const token = this.livekit.createJoinToken({
      identity: user.id,
      name: user.displayName,
      room,
    });
    return {
      url: this.livekit.websocketUrl,
      token,
      room,
    };
  }
}
