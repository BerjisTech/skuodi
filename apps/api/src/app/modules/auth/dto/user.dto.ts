import { UserEntity } from '../../../database/entities/user.entity';

export class UserDto {
  id!: string;
  email!: string;
  displayName!: string;
  avatarUrl?: string | null;
  createdAt!: Date;
  updatedAt!: Date;
  isAdmin!: boolean;

  static fromEntity(entity: UserEntity): UserDto {
    return {
      id: entity.id,
      email: entity.email,
      displayName: entity.displayName,
      avatarUrl: entity.avatarUrl ?? null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      isAdmin: entity.isAdmin ?? false,
    };
  }
}
