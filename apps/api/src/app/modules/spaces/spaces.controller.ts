import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { SpacesService } from './spaces.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import {
  toSpaceDto,
  toSpaceInviteDto,
  toSpaceMemberDto,
} from './dto/space.dto';

@Controller('spaces')
@UseGuards(JwtAuthGuard)
export class SpacesController {
  constructor(private readonly spacesService: SpacesService) {}

  @Get()
  async list(@CurrentUser() user: RequestUser) {
    const spaces = await this.spacesService.listSpacesForUser(user.userId);
    return spaces.map(toSpaceDto);
  }

  @Post()
  async create(@CurrentUser() user: RequestUser, @Body() body: CreateSpaceDto) {
    const space = await this.spacesService.createSpace(user.userId, body);
    return toSpaceDto(space);
  }

  @Get(':spaceId/members')
  async members(@Param('spaceId') spaceId: string) {
    const members = await this.spacesService.listMembers(spaceId);
    return members.map(toSpaceMemberDto);
  }

  @Post(':spaceId/invite')
  async invite(
    @CurrentUser() user: RequestUser,
    @Param('spaceId') spaceId: string,
    @Body() body: InviteMemberDto
  ) {
    const invite = await this.spacesService.inviteMember(
      user.userId,
      spaceId,
      body
    );
    return invite ? toSpaceInviteDto(invite) : { status: 'added' };
  }
}
