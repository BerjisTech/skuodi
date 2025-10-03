import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PasswordService {
  private readonly rounds = 12;

  async hash(input: string): Promise<string> {
    return bcrypt.hash(input, this.rounds);
  }

  async compare(input: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(input, hashed);
  }
}
