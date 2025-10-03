import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { SpaceRole } from '../../../database/entities/space-member.entity';

const ROLES: SpaceRole[] = ['user', 'architect', 'org_owner', 'admin'];

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsIn(ROLES)
  role!: SpaceRole;

  @IsOptional()
  @IsString()
  message?: string;
}
