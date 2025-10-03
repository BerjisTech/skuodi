import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SpaceEntity } from '../../database/entities/space.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { SpaceMemberEntity, SpaceRole } from '../../database/entities/space-member.entity';
import { SpaceInviteEntity } from '../../database/entities/space-invite.entity';
import { CreateSpaceDto } from './dto/create-space.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { v4 as uuid } from 'uuid';

const ADMIN_ROLES: SpaceRole[] = ['org_owner', 'admin'];

@Injectable()
export class SpacesService {
  constructor(
    @InjectRepository(SpaceEntity)
    private readonly spacesRepo: Repository<SpaceEntity>,
    @InjectRepository(SpaceMemberEntity)
    private readonly membersRepo: Repository<SpaceMemberEntity>,
    @InjectRepository(SpaceInviteEntity)
    private readonly invitesRepo: Repository<SpaceInviteEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>
  ) {}

  async createSpace(ownerId: string, dto: CreateSpaceDto): Promise<SpaceEntity> {
    const owner = await this.usersRepo.findOne({ where: { id: ownerId } });
    if (!owner) {
      throw new NotFoundException('Owner not found');
    }
    const space = this.spacesRepo.create({ name: dto.name, owner });
    const created = await this.spacesRepo.save(space);
    const membership = this.membersRepo.create({
      space: created,
      user: owner,
      role: 'org_owner',
    });
    await this.membersRepo.save(membership);
    return created;
  }

  async listSpacesForUser(userId: string): Promise<SpaceEntity[]> {
    const memberships = await this.membersRepo.find({
      where: { user: { id: userId } },
      relations: ['space', 'space.owner'],
      order: { createdAt: 'DESC' },
    });
    return memberships.map((membership) => membership.space);
  }

  async listMembers(spaceId: string): Promise<SpaceMemberEntity[]> {
    return this.membersRepo.find({
      where: { space: { id: spaceId } },
      relations: ['user'],
    });
  }

  async inviteMember(
    requesterId: string,
    spaceId: string,
    payload: InviteMemberDto
  ): Promise<SpaceInviteEntity | null> {
    const membership = await this.assertMembership(spaceId, requesterId);
    if (!ADMIN_ROLES.includes(membership.role)) {
      throw new ForbiddenException('Only space admins can invite members');
    }

    const targetEmail = payload.email.toLowerCase();
    const existingUser = await this.usersRepo.findOne({
      where: { email: targetEmail },
    });

    if (existingUser) {
      const alreadyMember = await this.membersRepo.findOne({
        where: { space: { id: spaceId }, user: { id: existingUser.id } },
      });
      if (alreadyMember) {
        throw new BadRequestException('User already a member');
      }
      const space = await this.spacesRepo.findOne({ where: { id: spaceId } });
      if (!space) {
        throw new NotFoundException('Space not found');
      }
      const member = this.membersRepo.create({
        space,
        user: existingUser,
        role: payload.role,
      });
      await this.membersRepo.save(member);
      return null;
    }

    const space = await this.spacesRepo.findOne({ where: { id: spaceId } });
    if (!space) {
      throw new NotFoundException('Space not found');
    }

    const invite = this.invitesRepo.create({
      space,
      createdBy: membership.user,
      email: targetEmail,
      role: payload.role,
      token: uuid(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    });

    return this.invitesRepo.save(invite);
  }

  private async assertMembership(spaceId: string, userId: string) {
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
