import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordService } from './password.service';

export interface JwtPayload {
  sub: string;
  email: string;
  isAdmin: boolean;
}

export interface AuthResult {
  token: string;
  user: UserEntity;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService
  ) {}

  async signup(dto: SignupDto): Promise<AuthResult> {
    const normalizedEmail = dto.email.toLowerCase();
    const existing = await this.usersRepo.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }
    const passwordHash = await this.passwordService.hash(dto.password);
    const user = this.usersRepo.create({
      email: normalizedEmail,
      passwordHash,
      displayName: dto.displayName,
    });
    const saved = await this.usersRepo.save(user);
    const token = this.issueToken(saved);
    return { token, user: saved };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const normalizedEmail = dto.email.toLowerCase();
    const user = await this.usersRepo.findOne({ where: { email: normalizedEmail } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await this.passwordService.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const token = this.issueToken(user);
    return { token, user };
  }

  async getProfile(userId: string): Promise<UserEntity> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  private issueToken(user: UserEntity): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      isAdmin: user.isAdmin ?? false,
    };
    return this.jwtService.sign(payload);
  }
}
