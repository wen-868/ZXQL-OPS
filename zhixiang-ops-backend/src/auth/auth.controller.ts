import { Controller, Post, Get, Body, UseGuards, Headers } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';
import { AuthUser } from './auth-user';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('ops/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** 登录：获取 JWT token */
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** 注册：创建账号（独立模式开放注册） */
  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /** SSO：用管理系统 JWT 换取运营 JWT（对接方案 §4.2，仅接受 zhixiang-system 签发） */
  @Public()
  @Post('sso')
  sso(
    @Headers('authorization') authorization?: string,
    @Headers('x-tenant-id') tenantHeader?: string,
  ) {
    return this.authService.sso(authorization, tenantHeader);
  }

  /** 演示登录：免密进入演示环境（仅 OPS_DEMO_MODE=true 时可用） */
  @Public()
  @Post('demo-login')
  demoLogin() {
    return this.authService.demoLogin();
  }

  /** 获取当前登录用户信息 */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.authService.getProfile(user.id);
  }
}
