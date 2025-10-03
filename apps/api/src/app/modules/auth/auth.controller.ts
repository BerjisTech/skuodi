import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { CurrentUser, RequestUser } from './current-user.decorator';
import { UserDto } from './dto/user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body() body: SignupDto) {
    const result = await this.authService.signup(body);
    return {
      token: result.token,
      user: UserDto.fromEntity(result.user),
    };
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    const result = await this.authService.login(body);
    return {
      token: result.token,
      user: UserDto.fromEntity(result.user),
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: RequestUser) {
    const profile = await this.authService.getProfile(user.userId);
    return UserDto.fromEntity(profile);
  }
}
